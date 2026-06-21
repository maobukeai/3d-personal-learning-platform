import { Router } from 'express';
import * as noteController from '../controllers/note.controller';
import * as noteCommentController from '../controllers/noteComment.controller';
import { importNotesFromGithub } from '../controllers/githubImport.controller';
import { authenticate, optionalAuthenticate } from '../middlewares/auth.middleware';
import rateLimit from 'express-rate-limit';
import { createRateLimitHandler } from '../middlewares/rate-limit.middleware';
import { createAiRateLimitKeyGenerator } from '../utils/ai-rate-limit';

const router = Router();

const noteAiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // Max 5 requests per minute
  skipSuccessfulRequests: false,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('AI 接口请求过于频繁，请稍后再试。', 'AI_RATE_LIMITED'),
  keyGenerator: createAiRateLimitKeyGenerator('note_ai_user', 'note_ai_ip'),
});

router.post('/import/github', authenticate, importNotesFromGithub);
router.get('/', authenticate, noteController.getNotes);
router.get('/popular', authenticate, noteController.getPopularNotes);
router.get('/tags', authenticate, noteController.getNoteTags);
router.get('/categories', authenticate, noteController.getNoteCategories);
router.get('/daily-quote', authenticate, noteController.getDailyQuote);
router.post('/daily-quote/generate', authenticate, noteController.generateDailyQuote);
router.get('/:id', authenticate, noteController.getNoteById);
router.post('/', authenticate, noteController.createNote);
router.put('/:id', authenticate, noteController.updateNote);
router.delete('/:id', authenticate, noteController.deleteNote);
router.post('/:id/like', authenticate, noteController.toggleLikeNote);
router.post('/:id/popular', authenticate, noteController.togglePopularNote);
router.post('/:id/ai-summarize', authenticate, noteAiRateLimiter, noteController.summarizeNote);

// Note sharing routes
router.get('/share/:shareId', noteController.getPublicSharedNote); // Public endpoint
router.post('/share/:shareId/ai-summarize', noteAiRateLimiter, noteController.summarizeSharedNote);
router.get('/:id/share', authenticate, noteController.getNoteShare);
router.post('/:id/share', authenticate, noteController.createOrUpdateNoteShare);
router.delete('/:id/share', authenticate, noteController.cancelNoteShare);

// Comment routes
router.get('/:id/comments', optionalAuthenticate, noteCommentController.getNoteComments);
router.post('/:id/comment', authenticate, noteCommentController.createNoteComment);
router.delete('/comment/:commentId', authenticate, noteCommentController.deleteNoteComment);

export default router;
