import { getDb } from '@/db/client';
import type { Recipe, RecipeItem } from '@/db/types';
import { nowIso } from '@/lib/date';

export interface RecipeItemInput {
  ingredient_id: number | null;
  name: string;
  qty: number;
  unit?: string | null;
}

export interface RecipeInput {
  product_id: number | null;
  name: string;
  yield_qty: number;
  notes?: string | null;
  items: RecipeItemInput[];
}

export async function listRecipes(): Promise<Recipe[]> {
  const db = await getDb();
  return db.getAllAsync<Recipe>('SELECT * FROM recipes ORDER BY name COLLATE NOCASE ASC');
}

export async function getRecipe(id: number): Promise<Recipe | null> {
  const db = await getDb();
  return db.getFirstAsync<Recipe>('SELECT * FROM recipes WHERE id = ?', [id]);
}

export async function getRecipeItems(recipeId: number): Promise<RecipeItem[]> {
  const db = await getDb();
  return db.getAllAsync<RecipeItem>('SELECT * FROM recipe_items WHERE recipe_id = ? ORDER BY id ASC', [recipeId]);
}

export async function createRecipe(input: RecipeInput): Promise<number> {
  const db = await getDb();
  const now = nowIso();
  let recipeId = 0;
  await db.withTransactionAsync(async () => {
    const res = await db.runAsync(
      `INSERT INTO recipes (product_id, name, yield_qty, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [input.product_id, input.name, input.yield_qty, input.notes ?? null, now, now],
    );
    recipeId = res.lastInsertRowId;
    for (const it of input.items) {
      await db.runAsync(
        'INSERT INTO recipe_items (recipe_id, ingredient_id, name, qty, unit) VALUES (?, ?, ?, ?, ?)',
        [recipeId, it.ingredient_id, it.name, it.qty, it.unit ?? null],
      );
    }
  });
  return recipeId;
}

export async function updateRecipe(id: number, input: RecipeInput): Promise<void> {
  const db = await getDb();
  const now = nowIso();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE recipes SET product_id = ?, name = ?, yield_qty = ?, notes = ?, updated_at = ? WHERE id = ?',
      [input.product_id, input.name, input.yield_qty, input.notes ?? null, now, id],
    );
    await db.runAsync('DELETE FROM recipe_items WHERE recipe_id = ?', [id]);
    for (const it of input.items) {
      await db.runAsync(
        'INSERT INTO recipe_items (recipe_id, ingredient_id, name, qty, unit) VALUES (?, ?, ?, ?, ?)',
        [id, it.ingredient_id, it.name, it.qty, it.unit ?? null],
      );
    }
  });
}

export async function deleteRecipe(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM recipes WHERE id = ?', [id]);
}

/** Total number of recipes. */
export async function countRecipes(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) AS c FROM recipes');
  return row?.c ?? 0;
}

/** Total ingredient cost (minor units) for a recipe using current ingredient unit costs. */
export async function computeRecipeCost(recipeId: number): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(ri.qty * COALESCE(i.unit_cost, 0)), 0) AS total
     FROM recipe_items ri LEFT JOIN ingredients i ON i.id = ri.ingredient_id
     WHERE ri.recipe_id = ?`,
    [recipeId],
  );
  return Math.round(row?.total ?? 0);
}
