import Task from '../models/Task.js';
import Comment from '../models/Comment.js';
import Activity from '../models/Activity.js';
import { asyncHandler, HttpError, requireFields, validateStringFields } from '../utils/http.js';

const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED'];
const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

function canManageProject(req) {
  return ['OWNER', 'ADMIN'].includes(req.organizationRole) ||
    req.project.owner.toString() === req.user.id ||
    (req.project.managers || []).some((manager) => manager.toString() === req.user.id);
}

function validateLabels(body) {
  if ('labels' in body && (!Array.isArray(body.labels) || body.labels.some((label) => typeof label !== 'string'))) {
    throw new HttpError(400, 'Labels must be an array of text values');
  }
}

export const listTasks = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
  const filter = { organization: req.organization._id, project: req.project._id };
  if (req.query.status && !TASK_STATUSES.includes(req.query.status)) {
    throw new HttpError(400, 'Choose a valid task status');
  }
  if (req.query.priority && !TASK_PRIORITIES.includes(req.query.priority)) {
    throw new HttpError(400, 'Choose a valid task priority');
  }
  if (req.query.status) filter.status = req.query.status;
  if (req.query.priority) filter.priority = req.query.priority;
  if (req.query.assignee === 'me') filter.assignee = req.user.id;
  else if (typeof req.query.assignee === 'string' && req.query.assignee) filter.assignee = req.query.assignee;
  const canViewAllTasks = ['OWNER', 'ADMIN'].includes(req.organizationRole) ||
    req.project.owner.toString() === req.user.id ||
    (req.project.managers || []).some((manager) => manager.toString() === req.user.id);
  if (!canViewAllTasks) filter.assignee = req.user.id;
  if (typeof req.query.search === 'string' && req.query.search.trim()) {
    const escaped = req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { title: { $regex: escaped, $options: 'i' } },
      { description: { $regex: escaped, $options: 'i' } },
      { labels: { $regex: escaped, $options: 'i' } }
    ];
  }
  const sortOptions = {
    createdAt: { createdAt: -1 },
    dueDate: { dueDate: 1 },
    priority: { priority: -1 },
    updatedAt: { updatedAt: -1 }
  };
  const sort = sortOptions[req.query.sort] || sortOptions.updatedAt;
  const [tasks, total] = await Promise.all([
    Task.find(filter).populate('assignee reporter', 'name email').sort(sort).skip((page - 1) * limit).limit(limit),
    Task.countDocuments(filter)
  ]);
  res.json({ tasks, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

export const createTask = asyncHandler(async (req, res) => {
  if (!canManageProject(req)) throw new HttpError(403, 'Only project managers can create tasks');
  requireFields(req.body, ['title']);
  validateStringFields(req.body, ['description']);
  validateLabels(req.body);
  if (req.body.assignee && !req.project.members.some((member) => member.toString() === req.body.assignee)) {
    throw new HttpError(400, 'Assignee must be a member of this project');
  }
  const task = await Task.create({
    organization: req.organization._id,
    project: req.project._id,
    title: req.body.title.trim(),
    description: req.body.description?.trim() || '',
    assignee: req.body.assignee || null,
    reporter: req.user.id,
    status: req.body.status || 'TODO',
    priority: req.body.priority || 'MEDIUM',
    dueDate: req.body.dueDate || undefined,
    labels: Array.isArray(req.body.labels) ? req.body.labels.map((label) => label.trim()).filter(Boolean).slice(0, 10) : []
  });
  await Activity.create({ organization: req.organization._id, project: req.project._id, task: task._id, actor: req.user.id, action: 'TASK_CREATED', detail: `Created task ${task.title}` });
  await task.populate('assignee reporter', 'name email');
  res.status(201).json({ task });
});

export const getTask = asyncHandler(async (req, res) => {
  await req.task.populate('assignee reporter', 'name email');
  res.json({ task: req.task });
});

export const updateTask = asyncHandler(async (req, res) => {
  if (!canManageProject(req)) throw new HttpError(403, 'Only project managers can edit task details');
  validateStringFields(req.body, ['title', 'description']);
  validateLabels(req.body);
  const before = {
    title: req.task.title,
    status: req.task.status,
    priority: req.task.priority,
    assignee: req.task.assignee?.toString() || ''
  };
  const editable = ['title', 'description', 'status', 'priority', 'dueDate', 'labels'];
  for (const field of editable) {
    if (field in req.body) req.task[field] = req.body[field];
  }
  if ('assignee' in req.body) {
    if (req.body.assignee && !req.project.members.some((member) => member.toString() === req.body.assignee)) {
      throw new HttpError(400, 'Assignee must be a member of this project');
    }
    req.task.assignee = req.body.assignee || null;
  }
  await req.task.save();
  const updates = [];
  if (before.title !== req.task.title) updates.push({ action: 'TASK_UPDATED', detail: `Updated task ${req.task.title}` });
  if (before.status !== req.task.status) updates.push({ action: 'TASK_STATUS_CHANGED', detail: `Changed ${req.task.title} to ${req.task.status.replace('_', ' ').toLowerCase()}` });
  if (before.priority !== req.task.priority) updates.push({ action: 'TASK_PRIORITY_CHANGED', detail: `Changed ${req.task.title} priority to ${req.task.priority.toLowerCase()}` });
  if (before.assignee !== (req.task.assignee?.toString() || '')) updates.push({ action: 'TASK_ASSIGNED', detail: `Updated the assignment for ${req.task.title}` });
  if (!updates.length) updates.push({ action: 'TASK_UPDATED', detail: `Updated task ${req.task.title}` });
  await Activity.insertMany(updates.map((update) => ({
    organization: req.organization._id, project: req.project._id, task: req.task._id,
    actor: req.user.id, ...update
  })));
  await req.task.populate('assignee reporter', 'name email');
  res.json({ task: req.task });
});

export const updateTaskStatus = asyncHandler(async (req, res) => {
  if (!TASK_STATUSES.includes(req.body?.status)) throw new HttpError(400, 'Choose a valid task status');
  if (!canManageProject(req) && req.task.assignee?.toString() !== req.user.id) {
    throw new HttpError(403, 'You can only update tasks assigned to you');
  }
  const previousStatus = req.task.status;
  req.task.status = req.body.status;
  await req.task.save();
  await Activity.create({
    organization: req.organization._id, project: req.project._id, task: req.task._id,
    actor: req.user.id, action: 'TASK_STATUS_CHANGED',
    detail: `Changed ${req.task.title} from ${previousStatus.replace('_', ' ').toLowerCase()} to ${req.task.status.replace('_', ' ').toLowerCase()}`
  });
  await req.task.populate('assignee reporter', 'name email');
  res.json({ task: req.task });
});

export const updateTaskAssignee = asyncHandler(async (req, res) => {
  if (!canManageProject(req)) throw new HttpError(403, 'Only project managers can assign tasks');
  if (!req.body || !('assignee' in req.body)) throw new HttpError(400, 'assignee is required');
  if (req.body.assignee && !req.project.members.some((member) => member.toString() === req.body.assignee)) {
    throw new HttpError(400, 'Assignee must be a member of this project');
  }
  req.task.assignee = req.body.assignee || null;
  await req.task.save();
  await Activity.create({ organization: req.organization._id, project: req.project._id, task: req.task._id, actor: req.user.id, action: 'TASK_ASSIGNED', detail: `${req.task.title} assignment updated` });
  await req.task.populate('assignee reporter', 'name email');
  res.json({ task: req.task });
});

export const deleteTask = asyncHandler(async (req, res) => {
  if (!canManageProject(req)) throw new HttpError(403, 'Only project managers can delete tasks');
  await Comment.deleteMany({ task: req.task._id });
  await Activity.create({ organization: req.organization._id, project: req.project._id, actor: req.user.id, action: 'TASK_DELETED', detail: `Deleted task ${req.task.title}` });
  await req.task.deleteOne();
  res.json({ message: 'Task deleted' });
});

export const listTaskComments = asyncHandler(async (req, res) => {
  const comments = await Comment.find({ task: req.task._id }).populate('author', 'name email').sort({ createdAt: 1 });
  res.json({ comments });
});

export const createTaskComment = asyncHandler(async (req, res) => {
  requireFields(req.body, ['text']);
  const comment = await Comment.create({
    organization: req.organization._id,
    project: req.project._id,
    task: req.task._id,
    author: req.user.id,
    text: req.body.text.trim()
  });
  await Activity.create({ organization: req.organization._id, project: req.project._id, task: req.task._id, actor: req.user.id, action: 'COMMENT_ADDED', detail: `Commented on ${req.task.title}` });
  await comment.populate('author', 'name email');
  res.status(201).json({ comment });
});

export const updateComment = asyncHandler(async (req, res) => {
  if (req.comment.author.toString() !== req.user.id) throw new HttpError(403, 'You can only edit your own comments');
  requireFields(req.body, ['text']);
  req.comment.text = req.body.text.trim();
  await req.comment.save();
  await req.comment.populate('author', 'name email');
  res.json({ comment: req.comment });
});

export const deleteComment = asyncHandler(async (req, res) => {
  if (req.comment.author.toString() !== req.user.id && !canManageProject(req)) {
    throw new HttpError(403, 'You do not have permission to remove this comment');
  }
  await req.comment.deleteOne();
  res.json({ message: 'Comment deleted' });
});
