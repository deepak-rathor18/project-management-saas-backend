import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { loadCommentAccess, loadProjectAccess, loadTaskAccess } from '../middleware/projectAccess.js';
import * as taskController from '../controllers/task.controller.js';

const router = Router();
router.use(authenticate);

router.get('/projects/:projectId/tasks', loadProjectAccess, taskController.listTasks);
router.post('/projects/:projectId/tasks', loadProjectAccess, taskController.createTask);
router.get('/tasks/:taskId', loadTaskAccess, loadProjectAccess, taskController.getTask);
router.put('/tasks/:taskId', loadTaskAccess, loadProjectAccess, taskController.updateTask);
router.patch('/tasks/:taskId/status', loadTaskAccess, loadProjectAccess, taskController.updateTaskStatus);
router.patch('/tasks/:taskId/assignee', loadTaskAccess, loadProjectAccess, taskController.updateTaskAssignee);
router.delete('/tasks/:taskId', loadTaskAccess, loadProjectAccess, taskController.deleteTask);
router.get('/tasks/:taskId/comments', loadTaskAccess, loadProjectAccess, taskController.listTaskComments);
router.post('/tasks/:taskId/comments', loadTaskAccess, loadProjectAccess, taskController.createTaskComment);
router.put('/comments/:commentId', loadCommentAccess, loadTaskAccess, loadProjectAccess, taskController.updateComment);
router.delete('/comments/:commentId', loadCommentAccess, loadTaskAccess, loadProjectAccess, taskController.deleteComment);

export default router;
