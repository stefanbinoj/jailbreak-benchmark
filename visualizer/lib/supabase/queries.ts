import { supabase } from './client';

/**
 * Fetch all records from a specified table.
 */
export async function fetchAllRecords(table: string) {
  const { data, error } = await supabase.from(table).select('*');
  
  if (error) {
    console.error(`Error fetching records from ${table}:`, error);
    throw error;
  }
  
  return data;
}

/**
 * Fetch a single record by its ID from a specified table.
 */
export async function fetchRecordById(table: string, id: string | number) {
  const { data, error } = await supabase.from(table).select('*').eq('id', id).single();
  
  if (error) {
    console.error(`Error fetching record by ID from ${table}:`, error);
    throw error;
  }
  
  return data;
}

/**
 * Fetch records with a specific column value.
 */
export async function fetchRecordsByCondition(table: string, column: string, value: any) {
  const { data, error } = await supabase.from(table).select('*').eq(column, value);
  
  if (error) {
    console.error(`Error fetching records by condition from ${table}:`, error);
    throw error;
  }
  
  return data;
}
