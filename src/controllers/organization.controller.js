import mongoose from "mongoose";
import Organization from "../models/Organization.js";
import Project from "../models/Project.js";
import Task from "../models/Task.js";
import User from "../models/User.js";
import Activity from "../models/Activity.js";
import {
  asyncHandler,
  HttpError,
  requireFields,
  validateStringFields,
} from "../utils/http.js";

async function findAccessibleProjects(organizationId, userId, isOrganizationAdmin) {
  const assignedProjectIds = isOrganizationAdmin
    ? []
    : await Task.distinct("project", {
        organization: organizationId,
        assignee: userId,
      });
  return Project.find({
    organization: organizationId,
    ...(isOrganizationAdmin
      ? {}
      : {
          $or: [
            { owner: userId },
            { members: userId },
            { managers: userId },
            { _id: { $in: assignedProjectIds } },
          ],
        }),
  }).select("_id");
}

export const createOrganization = asyncHandler(async (req, res) => {
  requireFields(req.body, ["name"]);
  validateStringFields(req.body, ["description"]);
  const organization = await Organization.create({
    name: req.body.name.trim(),
    description: req.body.description?.trim() || "",
    owner: req.user.id,
    members: [{ user: req.user.id, role: "OWNER" }],
  });
  res.status(201).json({ organization });
});

export const listOrganizations = asyncHandler(async (req, res) => {
  const organizations = await Organization.find({ "members.user": req.user.id })
    .populate("members.user", "name email")
    .sort({ updatedAt: -1 });
  res.json({ organizations });
});

export const getDashboard = asyncHandler(async (req, res) => {
  const orgId = req.organization._id;
  const isOrganizationAdmin = ["OWNER", "ADMIN"].includes(req.organizationRole);
  const accessibleProjects = await findAccessibleProjects(
    orgId,
    req.user.id,
    isOrganizationAdmin,
  );
  const projectIds = accessibleProjects.map((project) => project._id);
  const managerProjectIds = isOrganizationAdmin
    ? projectIds
    : (
        await Project.find({
          _id: { $in: projectIds },
          $or: [{ owner: req.user.id }, { managers: req.user.id }],
        }).select("_id")
      ).map((project) => project._id);
  const taskScope = { organization: orgId, project: { $in: projectIds } };
  if (!isOrganizationAdmin) {
    taskScope.$or = [
      { project: { $in: managerProjectIds } },
      { assignee: req.user.id },
    ];
  }
  const [
    projectCount,
    activeProjects,
    completedProjects,
    taskCount,
    assignedTasks,
    overdueTasks,
    statuses,
    priorities,
    recentActivity,
  ] = await Promise.all([
    Project.countDocuments({ _id: { $in: projectIds } }),
    Project.countDocuments({ _id: { $in: projectIds }, status: "ACTIVE" }),
    Project.countDocuments({ _id: { $in: projectIds }, status: "COMPLETED" }),
    Task.countDocuments(taskScope),
    Task.countDocuments({
      ...taskScope,
      assignee: req.user.id,
      status: { $ne: "COMPLETED" },
    }),
    Task.countDocuments({
      ...taskScope,
      dueDate: { $lt: new Date() },
      status: { $ne: "COMPLETED" },
    }),
    Task.aggregate([
      { $match: taskScope },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Task.aggregate([
      { $match: taskScope },
      { $group: { _id: "$priority", count: { $sum: 1 } } },
    ]),
    Activity.find({
      organization: orgId,
      ...(isOrganizationAdmin ? {} : { project: { $in: projectIds } }),
    })
      .populate("actor", "name")
      .sort({ createdAt: -1 })
      .limit(8),
  ]);
  res.json({
    dashboard: {
      projectCount,
      activeProjects,
      completedProjects,
      taskCount,
      assignedTasks,
      overdueTasks,
      tasksByStatus: Object.fromEntries(
        statuses.map((item) => [item._id, item.count]),
      ),
      tasksByPriority: Object.fromEntries(
        priorities.map((item) => [item._id, item.count]),
      ),
      recentActivity,
    },
  });
});

export const getOrganizationActivity = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
  const isOrganizationAdmin = ["OWNER", "ADMIN"].includes(req.organizationRole);
  const accessibleProjects = await findAccessibleProjects(
    req.organization._id,
    req.user.id,
    isOrganizationAdmin,
  );
  const projectIds = accessibleProjects.map((project) => project._id);
  const filter = {
    organization: req.organization._id,
    ...(isOrganizationAdmin ? {} : { project: { $in: projectIds } }),
  };
  const [activity, total] = await Promise.all([
    Activity.find(filter)
      .populate("actor", "name")
      .populate("project", "name")
      .populate("task", "title")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Activity.countDocuments(filter),
  ]);
  res.json({
    activity,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

export const getOrganization = asyncHandler(async (req, res) => {
  await req.organization.populate("members.user", "name email");
  res.json({ organization: req.organization });
});

export const updateOrganization = asyncHandler(async (req, res) => {
  validateStringFields(req.body, ["name", "description"]);
  if (typeof req.body.name === "string")
    req.organization.name = req.body.name.trim();
  if (typeof req.body.description === "string")
    req.organization.description = req.body.description.trim();
  await req.organization.save();
  await Activity.create({
    organization: req.organization._id,
    actor: req.user.id,
    action: "ORGANIZATION_UPDATED",
    detail: `Updated workspace ${req.organization.name}`,
  });
  res.json({ organization: req.organization });
});

export const addOrganizationMember = asyncHandler(async (req, res) => {
  requireFields(req.body, ["email"]);
  const user = await User.findOne({
    email: req.body.email.trim().toLowerCase(),
  });
  if (!user)
    throw new HttpError(404, "No registered user found for this email");
  if (
    req.organization.members.some(
      (member) => member.user.toString() === user.id,
    )
  ) {
    throw new HttpError(409, "This user is already a member");
  }
  req.organization.members.push({
    user: user._id,
    role: req.body.role === "ADMIN" ? "ADMIN" : "MEMBER",
  });
  await req.organization.save();
  await Activity.create({
    organization: req.organization._id,
    actor: req.user.id,
    action: "MEMBER_ADDED",
    detail: `${user.name} joined the organization`,
  });
  await req.organization.populate("members.user", "name email");
  res.status(201).json({ organization: req.organization });
});

export const updateOrganizationMemberRole = asyncHandler(async (req, res) => {
  validateStringFields(req.body, ["role"]);
  if (!["ADMIN", "MEMBER"].includes(req.body.role))
    throw new HttpError(400, "Role must be ADMIN or MEMBER");
  const member = req.organization.members.find(
    (item) => item.user.toString() === req.params.userId,
  );
  if (!member || member.role === "OWNER")
    throw new HttpError(404, "Organization member not found");
  member.role = req.body.role;
  await req.organization.save();
  await Activity.create({
    organization: req.organization._id,
    actor: req.user.id,
    action: "ORGANIZATION_MEMBER_ROLE_CHANGED",
    detail: "Changed a workspace member role",
  });
  await req.organization.populate("members.user", "name email");
  res.json({ organization: req.organization });
});

export const removeOrganizationMember = asyncHandler(async (req, res) => {
  if (req.params.userId === req.organization.owner.toString())
    throw new HttpError(400, "The organization owner cannot be removed");
  const member = req.organization.members.find(
    (item) => item.user.toString() === req.params.userId,
  );
  if (!member) throw new HttpError(404, "Organization member not found");
  if (req.organizationRole === "ADMIN" && member.role === "ADMIN")
    throw new HttpError(403, "Only the owner can remove an admin");
  req.organization.members = req.organization.members.filter(
    (item) => item.user.toString() !== req.params.userId,
  );
  await req.organization.save();
  await Project.updateMany(
    { organization: req.organization._id },
    {
      $pull: {
        members: new mongoose.Types.ObjectId(req.params.userId),
        managers: new mongoose.Types.ObjectId(req.params.userId),
      },
    },
  );
  await Task.updateMany(
    { organization: req.organization._id, assignee: req.params.userId },
    { $set: { assignee: null } },
  );
  await Activity.create({
    organization: req.organization._id,
    actor: req.user.id,
    action: "ORGANIZATION_MEMBER_REMOVED",
    detail: "Removed a member from the workspace",
  });
  res.json({ message: "Member removed from the organization" });
});
