import { AuthRequest } from '../../types/auth-request';
import { AppError } from '../../utils/error';
import prisma from '../../services/prisma';

/** Minimal Express-like response shape used by the legacy category handlers. */
interface FavoriteHandlerResponse {
  json: (body: unknown) => void;
}

/** Minimal Express-like next callback used by the legacy category handlers. */
type FavoriteHandlerNext = (err?: unknown) => void;

/**
 * Describes a Prisma favorite model delegate for a specific resource type.
 * Only the methods actually used by the factory are required.
 */
export interface FavoriteModelDelegate {
  /** Find many favorites for migration check */
  findMany: (args: {
    where: Record<string, unknown>;
    select: Record<string, unknown>;
  }) => Promise<{ id: string }[]>;
  /** Upsert a single favorite record during migration */
  upsert: (args: {
    where: Record<string, unknown>;
    update: Record<string, unknown>;
    create: Record<string, unknown>;
  }) => Promise<unknown>;
  /** Update many favorites (rename category) */
  updateMany: (args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }) => Promise<unknown>;
  /** Delete many favorites (remove category) */
  deleteMany: (args: { where: Record<string, unknown> }) => Promise<unknown>;
}

export interface FavoriteCategoryFactoryConfig {
  /** Prisma delegate for the favorite relation (e.g. prisma.pluginFavorite) */
  delegate: FavoriteModelDelegate;
  /** UserSetting key used to persist custom category names (e.g. 'plugin_favorite_categories') */
  settingsKey: string;
  /** Label used in user-facing messages (e.g. '插件', '素材') */
  resourceLabel: string;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

const getCustomCategories = async (userId: string, settingsKey: string): Promise<string[]> => {
  try {
    const setting = await prisma.userSetting.findUnique({
      where: { userId_key: { userId, key: settingsKey } },
    });
    if (setting?.value) {
      const parsed = JSON.parse(setting.value) as unknown;
      if (Array.isArray(parsed)) return parsed as string[];
    }
  } catch {
    // Gracefully fall back to empty list
  }
  return [];
};

const saveCustomCategories = async (
  userId: string,
  settingsKey: string,
  categories: string[],
): Promise<void> => {
  const uniqueCats = Array.from(new Set(categories.map((c) => c.trim()).filter(Boolean)));
  await prisma.userSetting.upsert({
    where: { userId_key: { userId, key: settingsKey } },
    update: { value: JSON.stringify(uniqueCats) },
    create: { userId, key: settingsKey, value: JSON.stringify(uniqueCats) },
  });
};

// ── Public factory ────────────────────────────────────────────────────────────

export interface FavoriteCategoryHandlers {
  /** GET  /…/favorites/categories  (or embedded in the favorites list endpoint) */
  getCategories: (userId: string) => Promise<string[]>;

  /** POST /…/favorites/categories */
  createCategory: (
    req: AuthRequest,
    res: FavoriteHandlerResponse,
    next: FavoriteHandlerNext,
  ) => Promise<void>;

  /** PUT  /…/favorites/categories */
  updateCategory: (
    req: AuthRequest,
    res: FavoriteHandlerResponse,
    next: FavoriteHandlerNext,
  ) => Promise<void>;

  /** DELETE /…/favorites/categories/:categoryName */
  deleteCategory: (
    req: AuthRequest,
    res: FavoriteHandlerResponse,
    next: FavoriteHandlerNext,
  ) => Promise<void>;

  /** Helper: ensure custom category is persisted when a user favorites with a new name */
  persistCategoryIfNew: (userId: string, category: string) => Promise<void>;

  /** Helper: read all categories for a given user */
  readCategories: (userId: string) => Promise<string[]>;
}

/**
 * Creates a set of typed Express route handlers for managing favorite categories.
 *
 * The factory pattern eliminates ~200 lines of near-identical code that was
 * previously duplicated across material.controller.ts, plugin.controller.ts,
 * and software.controller.ts.
 *
 * @example
 * ```ts
 * export const {
 *   createCategory: createFavoriteCategory,
 *   updateCategory: updateFavoriteCategory,
 *   deleteCategory: deleteFavoriteCategory,
 *   readCategories: getCustomCategories,
 *   persistCategoryIfNew,
 * } = createFavoriteCategoryHandlers({
 *   delegate: prisma.pluginFavorite as FavoriteModelDelegate,
 *   settingsKey: 'plugin_favorite_categories',
 *   resourceLabel: '插件',
 * });
 * ```
 */
export const createFavoriteCategoryHandlers = (
  config: FavoriteCategoryFactoryConfig,
): FavoriteCategoryHandlers => {
  const { delegate, settingsKey } = config;

  const readCategories = (userId: string) => getCustomCategories(userId, settingsKey);

  const persistCategoryIfNew = async (userId: string, category: string): Promise<void> => {
    if (!category || category === '默认') return;
    const cats = await readCategories(userId);
    if (!cats.includes(category)) {
      cats.push(category);
      await saveCustomCategories(userId, settingsKey, cats);
    }
  };

  const createCategory = async (
    req: AuthRequest,
    res: FavoriteHandlerResponse,
    next: FavoriteHandlerNext,
  ): Promise<void> => {
    const userId = req.userId as string;
    const { category } = req.body as { category?: string };

    if (!category?.trim()) {
      next(new AppError('分类名称不能为空', 400));
      return;
    }
    const newCat = category.trim();
    if (newCat === '默认') {
      next(new AppError('不能创建默认分类', 400));
      return;
    }

    try {
      const customCats = await readCategories(userId);
      if (!customCats.includes(newCat)) {
        customCats.push(newCat);
        await saveCustomCategories(userId, settingsKey, customCats);
      }
      res.json({ success: true, message: '分类创建成功', categories: ['默认', ...customCats] });
    } catch (error) {
      next(error);
    }
  };

  const updateCategory = async (
    req: AuthRequest,
    res: FavoriteHandlerResponse,
    next: FavoriteHandlerNext,
  ): Promise<void> => {
    const userId = req.userId as string;
    const { oldCategory, newCategory } = req.body as { oldCategory?: string; newCategory?: string };

    if (!oldCategory || !newCategory) {
      next(new AppError('缺少必要参数', 400));
      return;
    }
    const oldCat = oldCategory.trim();
    const newCat = newCategory.trim();

    if (oldCat === '默认' || newCat === '默认') {
      next(new AppError('不能重命名默认分类', 400));
      return;
    }

    try {
      await delegate.updateMany({
        where: { userId, category: oldCat },
        data: { category: newCat },
      });
      const customCats = await readCategories(userId);
      const updatedCats = customCats.map((c) => (c === oldCat ? newCat : c));
      await saveCustomCategories(userId, settingsKey, updatedCats);
      res.json({ success: true, message: '分类更新成功' });
    } catch (error) {
      next(error);
    }
  };

  const deleteCategory = async (
    req: AuthRequest,
    res: FavoriteHandlerResponse,
    next: FavoriteHandlerNext,
  ): Promise<void> => {
    const userId = req.userId as string;
    const categoryName = req.params?.categoryName as string;

    if (!categoryName) {
      next(new AppError('缺少分类名称', 400));
      return;
    }
    const cat = categoryName.trim();
    if (cat === '默认') {
      next(new AppError('不能删除默认分类', 400));
      return;
    }

    try {
      await delegate.deleteMany({ where: { userId, category: cat } });
      const customCats = await readCategories(userId);
      const filteredCats = customCats.filter((c) => c !== cat);
      await saveCustomCategories(userId, settingsKey, filteredCats);
      res.json({ success: true, message: '分类删除成功' });
    } catch (error) {
      next(error);
    }
  };

  return {
    getCategories: readCategories,
    readCategories,
    persistCategoryIfNew,
    createCategory,
    updateCategory,
    deleteCategory,
  };
};
