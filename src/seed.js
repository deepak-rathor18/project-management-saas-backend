import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDatabase } from './config/database.js';
import User from './models/User.js';
import Organization from './models/Organization.js';
import Project from './models/Project.js';
import Task from './models/Task.js';
import Comment from './models/Comment.js';
import Activity from './models/Activity.js';

const PASSWORD = 'Test@123456';
const USERS = [
  { key: 'owner', name: 'Aarav Sharma', email: 'owner@example.com' },
  { key: 'admin', name: 'Ananya Verma', email: 'admin@example.com' },
  { key: 'manager', name: 'Rohan Mehta', email: 'manager@example.com' },
  { key: 'member1', name: 'Priya Iyer', email: 'member1@example.com' },
  { key: 'member2', name: 'Arjun Nair', email: 'member2@example.com' }
];

const ORGANIZATIONS = [
  {
    key: 'studio',
    name: 'Taskflow Demo - Acme Studio',
    description: 'A creative product studio planning launches and delivering thoughtful customer experiences.',
    owner: 'owner',
    members: [
      ['owner', 'OWNER'], ['admin', 'ADMIN'], ['manager', 'MEMBER'],
      ['member1', 'MEMBER'], ['member2', 'MEMBER']
    ]
  },
  {
    key: 'labs',
    name: 'Taskflow Demo - Northstar Labs',
    description: 'An independent product team exploring customer insights and reliable operations.',
    owner: 'admin',
    members: [['admin', 'OWNER'], ['manager', 'MEMBER'], ['member2', 'MEMBER']]
  }
];

const PROJECTS = [
  {
    key: 'website',
    organization: 'studio',
    name: 'Website Refresh',
    description: 'A clearer, faster marketing site for the next chapter of Acme Studio.',
    status: 'ACTIVE',
    priority: 'HIGH',
    owner: 'owner',
    members: ['owner', 'manager', 'member1', 'member2'],
    managers: ['owner', 'manager'],
    taskOffset: 0
  },
  {
    key: 'mobile',
    organization: 'studio',
    name: 'Mobile App Launch',
    description: 'Prepare the companion app for a confident first release.',
    status: 'PLANNING',
    priority: 'CRITICAL',
    owner: 'admin',
    members: ['admin', 'manager', 'member1'],
    managers: ['admin', 'manager'],
    taskOffset: 1
  },
  {
    key: 'insights',
    organization: 'labs',
    name: 'Customer Insights',
    description: 'Turn customer interviews into a focused product roadmap.',
    status: 'ON_HOLD',
    priority: 'MEDIUM',
    owner: 'admin',
    members: ['admin', 'manager', 'member2'],
    managers: ['admin'],
    taskOffset: 2
  },
  {
    key: 'operations',
    organization: 'labs',
    name: 'Q4 Operations',
    description: 'Build a repeatable, resilient foundation for the next quarter.',
    status: 'COMPLETED',
    priority: 'LOW',
    owner: 'admin',
    members: ['admin', 'manager', 'member2'],
    managers: ['admin', 'manager'],
    taskOffset: 3
  }
];

const TASK_BLUEPRINTS = [
  { title: 'Confirm the project goals', description: 'Align the team on outcomes, measures of success, and the decisions this project needs to make.', status: 'TODO', priority: 'HIGH', dueInDays: -7, labels: ['planning', 'team'] },
  { title: 'Map the current experience', description: 'Document the important user journeys and capture the biggest opportunities to improve them.', status: 'IN_PROGRESS', priority: 'MEDIUM', dueInDays: 3, labels: ['research', 'discovery'] },
  { title: 'Review the first design direction', description: 'Collect feedback from the team and agree on the next iteration before implementation.', status: 'IN_REVIEW', priority: 'CRITICAL', dueInDays: 5, labels: ['design', 'review'] },
  { title: 'Share the project update', description: 'Prepare a short, clear update with decisions, progress, and next steps for stakeholders.', status: 'COMPLETED', priority: 'LOW', dueInDays: -4, labels: ['communication'] },
  { title: 'Prepare the implementation plan', description: 'Break the approved direction into milestones, ownership, and manageable delivery steps.', status: 'TODO', priority: 'MEDIUM', dueInDays: 8, labels: ['planning', 'delivery'] },
  { title: 'Build the first working slice', description: 'Deliver one end-to-end slice that the team can try and improve with real feedback.', status: 'IN_PROGRESS', priority: 'HIGH', dueInDays: 12, labels: ['development', 'milestone'] },
  { title: 'Quality-check the release candidate', description: 'Check expected behavior, accessibility, and edge cases before the work moves to release.', status: 'IN_REVIEW', priority: 'CRITICAL', dueInDays: 16, labels: ['quality', 'release'] },
  { title: 'Document what shipped', description: 'Record what changed, how to use it, and any follow-up work for the team.', status: 'COMPLETED', priority: 'LOW', dueInDays: -1, labels: ['documentation', 'launch'] }
];

const COMMENT_TEXTS = [
  'I added the notes from our latest team check-in. The next step looks clear.',
  'This is moving in the right direction. I will review the follow-up before our next sync.',
  'I have shared the latest version with the team so we can collect a little more feedback.',
  'The initial pass is complete. Please take a look and let me know what you would change.'
];

function dateFromToday(offsetDays) {
  const date = new Date();
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date;
}

function makeActivityIdentity(activity) {
  return {
    organization: activity.organization,
    project: activity.project || null,
    task: activity.task || null,
    actor: activity.actor,
    action: activity.action,
    detail: activity.detail
  };
}

async function upsertActivity(activity) {
  const identity = makeActivityIdentity(activity);
  return Activity.findOneAndUpdate(
    identity,
    { $setOnInsert: identity },
    { upsert: true, new: true, runValidators: true }
  );
}

async function assertSeedRelationships(users, organizations, projects, tasks, comments, activities) {
  const userIds = new Set(users.map((user) => user._id.toString()));
  const organizationIds = new Set(organizations.map((organization) => organization._id.toString()));
  const projectById = new Map(projects.map((project) => [project._id.toString(), project]));
  const taskIds = new Set(tasks.map((task) => task._id.toString()));

  for (const organization of organizations) {
    if (!userIds.has(organization.owner.toString())) throw new Error(`Organization ${organization.name} has an unknown owner`);
    for (const member of organization.members) {
      if (!userIds.has(member.user.toString())) throw new Error(`Organization ${organization.name} has an unknown member`);
    }
  }

  for (const project of projects) {
    const organization = organizations.find((item) => item._id.equals(project.organization));
    if (!organizationIds.has(project.organization.toString()) || !organization) {
      throw new Error(`Project ${project.name} has an unknown organization`);
    }
    const organizationMemberIds = new Set(organization.members.map((member) => member.user.toString()));
    if (!organizationMemberIds.has(project.owner.toString())) throw new Error(`Project ${project.name} owner is not in its organization`);
    for (const memberId of project.members.map((member) => member.toString())) {
      if (!organizationMemberIds.has(memberId)) throw new Error(`Project ${project.name} includes a non-organization member`);
    }
    for (const managerId of project.managers.map((manager) => manager.toString())) {
      if (!project.members.some((member) => member.toString() === managerId)) {
        throw new Error(`Project ${project.name} includes a manager who is not a project member`);
      }
    }
  }

  for (const task of tasks) {
    const project = projectById.get(task.project.toString());
    if (!project || !project.organization.equals(task.organization)) throw new Error(`Task ${task.title} has an invalid project relationship`);
    if (!userIds.has(task.reporter.toString())) throw new Error(`Task ${task.title} has an unknown reporter`);
    if (!task.assignee || !project.members.some((member) => member.equals(task.assignee))) {
      throw new Error(`Task ${task.title} has an invalid project assignee`);
    }
  }

  for (const comment of comments) {
    const task = tasks.find((item) => item._id.equals(comment.task));
    const project = projectById.get(comment.project.toString());
    if (!taskIds.has(comment.task.toString()) || !project || !task ||
        !task.project.equals(project._id) || !task.organization.equals(comment.organization) ||
        !project.organization.equals(comment.organization) || !userIds.has(comment.author.toString()) ||
        !organizationIds.has(comment.organization.toString())) {
      throw new Error(`Comment ${comment._id} has an invalid relationship`);
    }
  }

  for (const activity of activities) {
    if (!organizationIds.has(activity.organization.toString()) || !userIds.has(activity.actor.toString())) {
      throw new Error(`Activity ${activity._id} has an invalid organization or actor`);
    }
    if (activity.project) {
      const project = projectById.get(activity.project.toString());
      if (!project || !project.organization.equals(activity.organization)) {
        throw new Error(`Activity ${activity._id} has an invalid project`);
      }
    }
    if (activity.task) {
      const task = tasks.find((item) => item._id.equals(activity.task));
      if (!task || !task.organization.equals(activity.organization) ||
          (activity.project && !task.project.equals(activity.project))) {
        throw new Error(`Activity ${activity._id} has an invalid task`);
      }
    }
  }
}

async function seed() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed when NODE_ENV=production');
  }
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required; copy backend/.env.example to backend/.env');

  await connectDatabase();

  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const usersByKey = {};
  for (const definition of USERS) {
    usersByKey[definition.key] = await User.findOneAndUpdate(
      { email: definition.email },
      { $set: { name: definition.name, email: definition.email, passwordHash } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
  }
  const users = Object.values(usersByKey);

  const organizationsByKey = {};
  for (const definition of ORGANIZATIONS) {
    const owner = usersByKey[definition.owner];
    const members = definition.members.map(([key, role]) => ({ user: usersByKey[key]._id, role }));
    organizationsByKey[definition.key] = await Organization.findOneAndUpdate(
      { owner: owner._id, name: definition.name },
      {
        $set: { name: definition.name, description: definition.description, owner: owner._id, members }
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
  }
  const organizations = Object.values(organizationsByKey);

  const projectsByKey = {};
  for (const definition of PROJECTS) {
    const organization = organizationsByKey[definition.organization];
    projectsByKey[definition.key] = await Project.findOneAndUpdate(
      { organization: organization._id, name: definition.name },
      {
        $set: {
          organization: organization._id,
          name: definition.name,
          description: definition.description,
          status: definition.status,
          priority: definition.priority,
          startDate: dateFromToday(-21),
          dueDate: dateFromToday(definition.taskOffset + 18),
          owner: usersByKey[definition.owner]._id,
          members: definition.members.map((key) => usersByKey[key]._id),
          managers: definition.managers.map((key) => usersByKey[key]._id)
        }
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
  }
  const projects = Object.values(projectsByKey);

  const tasks = [];
  const comments = [];
  const activities = [];

  for (const organizationDefinition of ORGANIZATIONS) {
    const organization = organizationsByKey[organizationDefinition.key];
    const owner = usersByKey[organizationDefinition.owner];
    activities.push(await upsertActivity({
      organization: organization._id,
      actor: owner._id,
      action: 'ORGANIZATION_CREATED',
      detail: `Created workspace ${organization.name}`
    }));
    for (const [memberKey, role] of organizationDefinition.members) {
      if (memberKey === organizationDefinition.owner) continue;
      activities.push(await upsertActivity({
        organization: organization._id,
        actor: owner._id,
        action: 'MEMBER_ADDED',
        detail: `Added ${usersByKey[memberKey].name} as ${role.toLowerCase()}`
      }));
    }
  }

  for (const definition of PROJECTS) {
    const project = projectsByKey[definition.key];
    const organization = organizationsByKey[definition.organization];
    const projectOwner = usersByKey[definition.owner];
    activities.push(await upsertActivity({
      organization: organization._id, project: project._id, actor: projectOwner._id,
      action: 'PROJECT_CREATED', detail: `Created project ${project.name}`
    }));
    for (const managerKey of definition.managers) {
      if (managerKey === definition.owner) continue;
      activities.push(await upsertActivity({
        organization: organization._id, project: project._id, actor: projectOwner._id,
        action: 'PROJECT_MEMBER_ADDED', detail: `Added ${usersByKey[managerKey].name} as a project manager`
      }));
    }

    for (let index = 0; index < TASK_BLUEPRINTS.length; index += 1) {
      const blueprint = TASK_BLUEPRINTS[index];
      const assigneeKey = definition.members[(index + 1) % definition.members.length];
      const assignee = usersByKey[assigneeKey];
      const task = await Task.findOneAndUpdate(
        { project: project._id, title: blueprint.title },
        {
          $set: {
            organization: organization._id,
            project: project._id,
            title: blueprint.title,
            description: blueprint.description,
            assignee: assignee._id,
            reporter: projectOwner._id,
            status: blueprint.status,
            priority: blueprint.priority,
            dueDate: dateFromToday(blueprint.dueInDays + definition.taskOffset),
            labels: blueprint.labels
          }
        },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
      );
      tasks.push(task);

      activities.push(await upsertActivity({
        organization: organization._id, project: project._id, task: task._id,
        actor: projectOwner._id, action: 'TASK_CREATED', detail: `Created task ${task.title}`
      }));
      activities.push(await upsertActivity({
        organization: organization._id, project: project._id, task: task._id,
        actor: projectOwner._id, action: 'TASK_ASSIGNED', detail: `Assigned ${task.title} to ${assignee.name}`
      }));
      if (task.status !== 'TODO') {
        activities.push(await upsertActivity({
          organization: organization._id, project: project._id, task: task._id,
          actor: assignee._id, action: 'TASK_STATUS_CHANGED',
          detail: `Changed ${task.title} to ${task.status.replace('_', ' ').toLowerCase()}`
        }));
      }

      if (index % 2 === 0) {
        for (let noteIndex = 0; noteIndex < 2; noteIndex += 1) {
          const authorKey = definition.members[(index + noteIndex + 1) % definition.members.length];
          const author = usersByKey[authorKey];
          const text = COMMENT_TEXTS[(index + noteIndex + definition.taskOffset) % COMMENT_TEXTS.length];
          const comment = await Comment.findOneAndUpdate(
            { task: task._id, author: author._id, text },
            {
              $set: {
                organization: organization._id,
                project: project._id,
                task: task._id,
                author: author._id,
                text
              }
            },
            { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
          );
          comments.push(comment);
          activities.push(await upsertActivity({
            organization: organization._id, project: project._id, task: task._id,
            actor: author._id, action: 'COMMENT_ADDED', detail: `Commented on ${task.title}`
          }));
        }
      }
    }
  }

  await assertSeedRelationships(users, organizations, projects, tasks, comments, activities);

  const activityCount = new Set(activities.map((activity) => activity._id.toString())).size;

  console.log('Taskflow development seed complete.');
  console.log(`Users: ${users.length}; organizations: ${organizations.length}; projects: ${projects.length}; tasks: ${tasks.length}; comments: ${comments.length}; activity logs: ${activityCount}.`);
  console.log(`Shared development password: ${PASSWORD}`);
  for (const user of USERS) {
    const organizationRoles = ORGANIZATIONS
      .filter((organization) => organization.members.some(([memberKey]) => memberKey === user.key))
      .map((organization) => {
        const [, role] = organization.members.find(([memberKey]) => memberKey === user.key);
        return `${organization.name} (${role})`;
      });
    const projectRoles = PROJECTS
      .filter((project) => project.members.includes(user.key))
      .map((project) => {
        const role = project.managers.includes(user.key) ? 'Manager' : 'Member';
        return `${project.name} (${role})`;
      });
    console.log(`  ${user.email} - workspace: ${organizationRoles.join(', ')}; projects: ${projectRoles.join(', ') || 'none'}`);
  }
}

seed()
  .catch((error) => {
    console.error('Seed failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
