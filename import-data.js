import { createClient } from '@supabase/supabase-js';
import pkg from 'pg';
const { Client } = pkg;

// Supabase credentials
const SUPABASE_URL = 'https://sxseepxijyxycocssyfq.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4c2VlcHhpanl4eWNvY3NzeWZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODc0ODQ5OSwiZXhwIjoyMDc0MzI0NDk5fQ.0By5_o9duyF4eFFSGvwFj8lD08q3zZL5BxdKvHTfPWE';

// Current Render database
const RENDER_DB_URL = 'postgresql://letrents_db_user:meXfl7uVGNxEGETEmS3Bim6Nxp5EtQl0@dpg-d3a37s6mcj7s73e3lk60-a.oregon-postgres.render.com/letrents_db';

console.log('📥 Starting data import to Supabase...');

// Initialize Supabase client with service role key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function exportRenderData() {
  console.log('📤 Exporting data from Render PostgreSQL...');
  
  const renderClient = new Client({
    connectionString: RENDER_DB_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await renderClient.connect();
    console.log('✅ Connected to Render database');

    // Export companies
    const companiesResult = await renderClient.query('SELECT * FROM companies ORDER BY created_at');
    console.log(`📊 Found ${companiesResult.rows.length} companies`);

    // Export users
    const usersResult = await renderClient.query('SELECT * FROM users ORDER BY created_at');
    console.log(`👥 Found ${usersResult.rows.length} users`);

    // Export properties
    const propertiesResult = await renderClient.query('SELECT * FROM properties ORDER BY created_at');
    console.log(`🏠 Found ${propertiesResult.rows.length} properties`);

    // Export units
    let unitsResult = { rows: [] };
    try {
      unitsResult = await renderClient.query('SELECT * FROM units ORDER BY created_at');
      console.log(`🏢 Found ${unitsResult.rows.length} units`);
    } catch (error) {
      console.log('⚠️  No units table found or empty');
    }

    await renderClient.end();

    return {
      companies: companiesResult.rows,
      users: usersResult.rows,
      properties: propertiesResult.rows,
      units: unitsResult.rows
    };

  } catch (error) {
    console.error('❌ Error exporting data:', error);
    await renderClient.end();
    throw error;
  }
}

async function importToSupabase(data) {
  console.log('📥 Importing data to Supabase...');

  try {
    // Import companies first (dependencies)
    if (data.companies.length > 0) {
      console.log(`Importing ${data.companies.length} companies...`);
      const { error: companiesError } = await supabase
        .from('companies')
        .upsert(data.companies, { onConflict: 'id' });
      
      if (companiesError) {
        console.error('❌ Error importing companies:', companiesError);
        throw companiesError;
      }
      console.log(`✅ Imported ${data.companies.length} companies`);
    }

    // Import users (depends on companies)
    if (data.users.length > 0) {
      console.log(`Importing ${data.users.length} users...`);
      const { error: usersError } = await supabase
        .from('users')
        .upsert(data.users, { onConflict: 'id' });
      
      if (usersError) {
        console.error('❌ Error importing users:', usersError);
        throw usersError;
      }
      console.log(`✅ Imported ${data.users.length} users`);
    }

    // Import properties (depends on companies and users)
    if (data.properties.length > 0) {
      console.log(`Importing ${data.properties.length} properties...`);
      const { error: propertiesError } = await supabase
        .from('properties')
        .upsert(data.properties, { onConflict: 'id' });
      
      if (propertiesError) {
        console.error('❌ Error importing properties:', propertiesError);
        throw propertiesError;
      }
      console.log(`✅ Imported ${data.properties.length} properties`);
    }

    // Import units (depends on properties)
    if (data.units.length > 0) {
      console.log(`Importing ${data.units.length} units...`);
      const { error: unitsError } = await supabase
        .from('units')
        .upsert(data.units, { onConflict: 'id' });
      
      if (unitsError) {
        console.error('❌ Error importing units:', unitsError);
        throw unitsError;
      }
      console.log(`✅ Imported ${data.units.length} units`);
    }

  } catch (error) {
    console.error('❌ Error importing data:', error);
    throw error;
  }
}

async function verifyMigration() {
  console.log('🔍 Verifying migration...');

  try {
    const { count: companiesCount } = await supabase
      .from('companies')
      .select('*', { count: 'exact', head: true });

    const { count: usersCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    const { count: propertiesCount } = await supabase
      .from('properties')
      .select('*', { count: 'exact', head: true });

    const { count: unitsCount } = await supabase
      .from('units')
      .select('*', { count: 'exact', head: true });

    console.log('\n📊 Migration Summary:');
    console.log(`  Companies: ${companiesCount || 0}`);
    console.log(`  Users: ${usersCount || 0}`);
    console.log(`  Properties: ${propertiesCount || 0}`);
    console.log(`  Units: ${unitsCount || 0}`);

    console.log('\n🎉 Migration verification complete!');
  } catch (error) {
    console.error('❌ Error verifying migration:', error);
    throw error;
  }
}

// Main import function
async function importData() {
  try {
    console.log('\n📥 Starting data import to Supabase...\n');

    // Step 1: Export data
    const data = await exportRenderData();
    
    // Step 2: Import data
    await importToSupabase(data);
    
    // Step 3: Verify
    await verifyMigration();
    
    console.log('\n🎉 Data import completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('  1. Update frontend to use Supabase client');
    console.log('  2. Set up Row Level Security policies');
    console.log('  3. Configure authentication');
    console.log('  4. Test the application');

  } catch (error) {
    console.error('\n❌ Data import failed:', error);
    process.exit(1);
  }
}

// Run import
importData();
