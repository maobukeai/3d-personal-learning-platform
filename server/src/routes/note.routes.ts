import { Router } from 'express';
import * as noteController from '../controllers/note.controller';
import * as noteCommentController from '../controllers/noteComment.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', authenticate, noteController.getNotes);
router.get('/popular', authenticate, noteController.getPopularNotes);
router.get('/tags', authenticate, noteController.getNoteTags);
router.get('/categories', authenticate, noteController.getNoteCategories);
router.get('/:id', authenticate, noteController.getNoteById);
router.post('/', authenticate, noteController.createNote);
router.put('/:id', authenticate, noteController.updateNote);
router.delete('/:id', authenticate, noteController.deleteNote);
router.post('/:id/like', authenticate, noteController.toggleLikeNote);
router.post('/:id/popular', authenticate, noteController.togglePopularNote);

// Comment routes
router.get('/:id/comments', authenticate, noteCommentController.getNoteComments);
router.post('/:id/comment', authenticate, noteCommentController.createNoteComment);
router.delete('/comment/:commentId', authenticate, noteCommentController.deleteNoteComment);

export default router;
