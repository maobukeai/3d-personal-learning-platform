const mockTutorialStepFindUnique = jest.fn();
const mockTutorialStepUpdate = jest.fn();
const mockRefreshTutorialLessonContent = jest.fn();
const mockStoreTutorialImage = jest.fn();
const mockDeleteTutorialImage = jest.fn();

jest.mock('../src/services/prisma', () => ({
  __esModule: true,
  default: {
    tutorialStep: {
      findUnique: mockTutorialStepFindUnique,
      update: mockTutorialStepUpdate,
    },
  },
}));

jest.mock('../src/services/tutorial-content.service', () => ({
  deleteTutorialLessonWithImages: jest.fn(),
  deleteTutorialSectionWithImages: jest.fn(),
  deleteTutorialStepWithImage: jest.fn(),
  getCourseTutorialContent: jest.fn(),
  importTutorialPackage: jest.fn(),
  refreshTutorialLessonContent: mockRefreshTutorialLessonContent,
}));

jest.mock('../src/services/tutorial-image.storage', () => ({
  deleteTutorialImage: mockDeleteTutorialImage,
  storeTutorialImage: mockStoreTutorialImage,
}));

import { replaceStepImage } from '../src/controllers/tutorial-package.controller';

const currentStep = {
  id: 'step-1',
  imageKey: 'courses/course-1/tutorials/lesson-1/old.webp',
  imageSize: 100,
  storageConfigId: 'storage-1',
  section: {
    lessonId: 'lesson-1',
    lesson: { courseId: 'course-1' },
  },
};

const storedImage = {
  url: 'https://cdn.example.com/courses/course-1/tutorials/lesson-1/new.webp',
  key: 'courses/course-1/tutorials/lesson-1/new.webp',
  size: 200,
  storageConfigId: 'storage-1',
};

const makeRequest = () =>
  ({
    params: { id: 'step-1' },
    file: jest
      .fn()
      .mockResolvedValue({ toBuffer: jest.fn().mockResolvedValue(Buffer.from('img')) }),
  }) as never;

const makeReply = () =>
  ({
    send: jest.fn((value) => value),
  }) as never;

describe('replaceStepImage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTutorialStepFindUnique.mockResolvedValue(currentStep);
    mockStoreTutorialImage.mockResolvedValue(storedImage);
    mockTutorialStepUpdate.mockResolvedValue({ ...currentStep, imageUrl: storedImage.url });
    mockRefreshTutorialLessonContent.mockResolvedValue({ id: 'lesson-1' });
    mockDeleteTutorialImage.mockResolvedValue(undefined);
  });

  it('keeps the committed new image when deleting the previous image fails', async () => {
    mockDeleteTutorialImage.mockRejectedValueOnce(new Error('R2 unavailable'));
    const reply = makeReply();

    await expect(replaceStepImage(makeRequest(), reply)).resolves.toBeDefined();

    expect(mockTutorialStepUpdate).toHaveBeenCalledTimes(1);
    expect(mockRefreshTutorialLessonContent).toHaveBeenCalledWith('lesson-1');
    expect(mockDeleteTutorialImage).toHaveBeenCalledTimes(1);
    expect(mockDeleteTutorialImage).toHaveBeenCalledWith(currentStep);
  });

  it('does not delete the committed new image when content refresh fails', async () => {
    mockRefreshTutorialLessonContent.mockRejectedValueOnce(new Error('database unavailable'));

    await expect(replaceStepImage(makeRequest(), makeReply())).rejects.toThrow(
      'database unavailable',
    );

    expect(mockTutorialStepUpdate).toHaveBeenCalledTimes(1);
    expect(mockDeleteTutorialImage).not.toHaveBeenCalled();
  });

  it('rolls back the uploaded image when the database update fails', async () => {
    mockTutorialStepUpdate.mockRejectedValueOnce(new Error('database unavailable'));

    await expect(replaceStepImage(makeRequest(), makeReply())).rejects.toThrow(
      'database unavailable',
    );

    expect(mockDeleteTutorialImage).toHaveBeenCalledTimes(1);
    expect(mockDeleteTutorialImage).toHaveBeenCalledWith({
      imageKey: storedImage.key,
      imageSize: storedImage.size,
      storageConfigId: storedImage.storageConfigId,
    });
    expect(mockRefreshTutorialLessonContent).not.toHaveBeenCalled();
  });
});
