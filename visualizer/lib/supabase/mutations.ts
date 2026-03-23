import { supabase } from './client';

/**
 * Insert a new record into a specified table.
 */
export async function insertRecord(table: string, record: Record<string, any>) {
  const { data, error } = await supabase.from(table).insert(record).select().single();
  
  if (error) {
    console.error(`Error inserting record into ${table}:`, error);
    throw error;
  }
  
  return data;
}

/**
 * Update an existing record in a specified table by its ID.
 */
export async function updateRecord(table: string, id: string | number, updates: Record<string, any>) {
  const { data, error } = await supabase.from(table).update(updates).eq('id', id).select().single();
  
  if (error) {
    console.error(`Error updating record in ${table}:`, error);
    throw error;
  }
  
  return data;
}

/**
 * Delete a record from a specified table by its ID.
 */
export async function deleteRecord(table: string, id: string | number) {
  const { error } = await supabase.from(table).delete().eq('id', id);
  
  if (error) {
    console.error(`Error deleting record from ${table}:`, error);
    throw error;
  }
  
  return true;
}
