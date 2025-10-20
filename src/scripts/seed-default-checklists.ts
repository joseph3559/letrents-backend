// ============================================================================
// Seed Default Checklist Templates
// ============================================================================
// Run this script to populate the database with standard checklist templates

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Standard Move-In Checklist
const moveInTemplate = {
  name: 'Standard Move-In Inspection',
  description: 'Comprehensive move-in inspection checklist for residential units',
  inspection_type: 'move_in',
  scope: 'company',
  is_default: true,
  categories: [
    {
      name: 'Living Room',
      description: 'Inspect all aspects of the living room',
      display_order: 1,
      items: [
        { name: 'Walls & Paint Condition', description: 'Check for cracks, stains, or damage', display_order: 1, is_required: true },
        { name: 'Flooring Condition', description: 'Inspect carpets, tiles, or wooden floors', display_order: 2, is_required: true },
        { name: 'Windows & Frames', description: 'Check for proper operation and damage', display_order: 3, is_required: true, requires_photo: true },
        { name: 'Doors & Locks', description: 'Test all doors and locks', display_order: 4, is_required: true },
        { name: 'Light Fixtures', description: 'Test all lights and switches', display_order: 5, is_required: true },
        { name: 'Electrical Outlets', description: 'Test all outlets for functionality', display_order: 6, is_required: true },
        { name: 'Ceiling & Fans', description: 'Check for damage and test ceiling fans', display_order: 7 },
      ],
    },
    {
      name: 'Kitchen',
      description: 'Inspect kitchen area and appliances',
      display_order: 2,
      items: [
        { name: 'Cabinets & Drawers', description: 'Check operation and condition', display_order: 1, is_required: true },
        { name: 'Countertops & Sink', description: 'Inspect for damage, stains, or leaks', display_order: 2, is_required: true },
        { name: 'Stove/Cooktop', description: 'Test all burners and oven', display_order: 3, is_required: true },
        { name: 'Refrigerator', description: 'Check cooling function and cleanliness', display_order: 4, is_required: true },
        { name: 'Dishwasher', description: 'Test operation', display_order: 5 },
        { name: 'Plumbing & Faucets', description: 'Check for leaks and water pressure', display_order: 6, is_required: true },
        { name: 'Ventilation/Exhaust Fan', description: 'Test exhaust fan operation', display_order: 7 },
      ],
    },
    {
      name: 'Bathrooms',
      description: 'Inspect all bathrooms',
      display_order: 3,
      items: [
        { name: 'Toilet', description: 'Test flush and check for leaks', display_order: 1, is_required: true },
        { name: 'Sink & Faucet', description: 'Test water flow and check for leaks', display_order: 2, is_required: true },
        { name: 'Shower/Bathtub', description: 'Check tiles, grout, and drainage', display_order: 3, is_required: true, requires_photo: true },
        { name: 'Mirrors & Cabinets', description: 'Check condition and operation', display_order: 4 },
        { name: 'Ventilation Fan', description: 'Test exhaust fan', display_order: 5 },
        { name: 'Water Heater', description: 'Check hot water availability', display_order: 6, is_required: true },
      ],
    },
    {
      name: 'Bedrooms',
      description: 'Inspect all bedrooms',
      display_order: 4,
      items: [
        { name: 'Walls & Paint', description: 'Check for damage or stains', display_order: 1, is_required: true },
        { name: 'Flooring', description: 'Inspect condition', display_order: 2, is_required: true },
        { name: 'Closets', description: 'Check doors, shelving, and rods', display_order: 3 },
        { name: 'Windows & Blinds', description: 'Test operation', display_order: 4, is_required: true },
        { name: 'Electrical Outlets & Lights', description: 'Test all outlets and fixtures', display_order: 5, is_required: true },
      ],
    },
    {
      name: 'Utilities & Systems',
      description: 'Check utility systems',
      display_order: 5,
      items: [
        { name: 'Electricity Meter Reading', description: 'Record current reading', display_order: 1, is_required: true, requires_photo: true },
        { name: 'Water Meter Reading', description: 'Record current reading', display_order: 2, is_required: true, requires_photo: true },
        { name: 'Heating/Cooling System', description: 'Test HVAC functionality', display_order: 3, is_required: true },
        { name: 'Fire Alarms', description: 'Test all smoke/fire detectors', display_order: 4, is_required: true },
        { name: 'Security System', description: 'Test if applicable', display_order: 5 },
      ],
    },
    {
      name: 'Exterior & Common Areas',
      description: 'Inspect exterior and shared spaces',
      display_order: 6,
      items: [
        { name: 'Balcony/Patio', description: 'Check condition and safety', display_order: 1, requires_photo: true },
        { name: 'Parking Space', description: 'Verify assignment and condition', display_order: 2 },
        { name: 'Entry Door & Lock', description: 'Test main entrance', display_order: 3, is_required: true },
        { name: 'Mailbox & Keys', description: 'Verify mailbox access', display_order: 4 },
      ],
    },
  ],
};

// Standard Move-Out Checklist
const moveOutTemplate = {
  name: 'Standard Move-Out Inspection',
  description: 'Comprehensive move-out inspection checklist for residential units',
  inspection_type: 'move_out',
  scope: 'company',
  is_default: true,
  categories: [
    {
      name: 'General Cleaning',
      description: 'Verify overall cleanliness',
      display_order: 1,
      items: [
        { name: 'All Rooms Swept/Vacuumed', description: 'Check floor cleanliness', display_order: 1, is_required: true },
        { name: 'All Surfaces Wiped', description: 'Check counters, shelves, etc.', display_order: 2, is_required: true },
        { name: 'Trash Removed', description: 'All garbage and debris cleared', display_order: 3, is_required: true },
        { name: 'Odors Addressed', description: 'Unit is fresh and clean-smelling', display_order: 4, is_required: true },
      ],
    },
    {
      name: 'Damages Assessment',
      description: 'Document any damages',
      display_order: 2,
      items: [
        { name: 'Wall Damage', description: 'Holes, marks, or stains beyond normal wear', display_order: 1, is_required: true, requires_photo: true },
        { name: 'Floor Damage', description: 'Scratches, stains, or broken tiles', display_order: 2, is_required: true, requires_photo: true },
        { name: 'Broken Fixtures', description: 'Any broken lights, fans, or fittings', display_order: 3, is_required: true },
        { name: 'Appliance Damage', description: 'Check all appliances for damage', display_order: 4, is_required: true },
        { name: 'Door/Window Damage', description: 'Check for broken or damaged doors/windows', display_order: 5, is_required: true },
      ],
    },
    {
      name: 'Key & Access Returns',
      description: 'Verify all keys and access cards returned',
      display_order: 3,
      items: [
        { name: 'Main Door Keys', description: 'All keys accounted for', display_order: 1, is_required: true },
        { name: 'Mailbox Keys', description: 'Mailbox key returned', display_order: 2, is_required: true },
        { name: 'Access Cards/Fobs', description: 'All access cards returned', display_order: 3 },
        { name: 'Parking Pass', description: 'Parking permit returned if applicable', display_order: 4 },
      ],
    },
    {
      name: 'Final Meter Readings',
      description: 'Record final utility readings',
      display_order: 4,
      items: [
        { name: 'Final Electricity Reading', description: 'Record and photograph', display_order: 1, is_required: true, requires_photo: true },
        { name: 'Final Water Reading', description: 'Record and photograph', display_order: 2, is_required: true, requires_photo: true },
        { name: 'Final Gas Reading', description: 'If applicable', display_order: 3 },
      ],
    },
  ],
};

// Periodic Inspection Template
const periodicTemplate = {
  name: 'Periodic Property Inspection',
  description: 'Routine inspection for occupied units',
  inspection_type: 'periodic',
  scope: 'company',
  is_default: true,
  categories: [
    {
      name: 'General Condition',
      description: 'Overall unit condition',
      display_order: 1,
      items: [
        { name: 'Overall Cleanliness', description: 'Unit is reasonably clean and maintained', display_order: 1, is_required: true },
        { name: 'No Unauthorized Modifications', description: 'No unapproved alterations', display_order: 2, is_required: true },
        { name: 'No Overcrowding', description: 'Occupancy within lease terms', display_order: 3 },
        { name: 'No Pets (if not allowed)', description: 'Verify pet policy compliance', display_order: 4 },
      ],
    },
    {
      name: 'Safety Checks',
      description: 'Safety equipment and hazards',
      display_order: 2,
      items: [
        { name: 'Smoke Detectors Functional', description: 'Test all smoke detectors', display_order: 1, is_required: true },
        { name: 'Fire Extinguisher Present', description: 'If required, check presence and expiry', display_order: 2 },
        { name: 'No Fire Hazards', description: 'Check for blocked exits, etc.', display_order: 3, is_required: true },
        { name: 'Electrical Safety', description: 'No overloaded outlets or exposed wiring', display_order: 4, is_required: true },
      ],
    },
    {
      name: 'Maintenance Issues',
      description: 'Identify needed repairs',
      display_order: 3,
      items: [
        { name: 'Plumbing Leaks', description: 'Check for any leaks', display_order: 1, is_required: true },
        { name: 'Appliance Functionality', description: 'Test major appliances', display_order: 2, is_required: true },
        { name: 'HVAC Performance', description: 'Check heating/cooling', display_order: 3 },
        { name: 'Structural Issues', description: 'Any cracks, settling, or damage', display_order: 4, requires_notes: true },
      ],
    },
  ],
};

async function seedChecklists() {
  console.log('🌱 Starting checklist template seeding...');

  try {
    // Get first company to use for default templates
    const company = await prisma.company.findFirst();
    
    if (!company) {
      console.error('❌ No company found in database. Please create a company first.');
      return;
    }

    // Get first admin user as creator
    const admin = await prisma.user.findFirst({
      where: {
        role: { in: ['super_admin', 'agency_admin'] },
      },
    });

    if (!admin) {
      console.error('❌ No admin user found. Please create an admin user first.');
      return;
    }

    console.log(`✓ Found company: ${company.name}`);
    console.log(`✓ Using admin: ${admin.first_name} ${admin.last_name}`);

    const templates = [moveInTemplate, moveOutTemplate, periodicTemplate];

    for (const templateData of templates) {
      // Check if template already exists
      const existing = await prisma.checklistTemplate.findFirst({
        where: {
          name: templateData.name,
          company_id: company.id,
        },
      });

      if (existing) {
        console.log(`⏭️  Skipping "${templateData.name}" - already exists`);
        continue;
      }

      // Create template with categories and items
      const template = await prisma.checklistTemplate.create({
        data: {
          company_id: company.id,
          name: templateData.name,
          description: templateData.description,
          inspection_type: templateData.inspection_type as any,
          scope: templateData.scope as any,
          is_default: templateData.is_default,
          created_by: admin.id,
          categories: {
            create: templateData.categories.map((cat: any) => ({
              name: cat.name,
              description: cat.description,
              display_order: cat.display_order,
              items: {
                create: cat.items.map((item: any) => ({
                  name: item.name,
                  description: item.description,
                  display_order: item.display_order,
                  is_required: item.is_required || false,
                  requires_photo: item.requires_photo || false,
                  requires_notes: item.requires_notes || false,
                })),
              },
            })),
          },
        },
        include: {
          categories: {
            include: {
              items: true,
            },
          },
        },
      });

      const itemCount = template.categories.reduce((sum: number, cat: any) => sum + cat.items.length, 0);
      console.log(`✅ Created "${template.name}" with ${template.categories.length} categories and ${itemCount} items`);
    }

    console.log('\n🎉 Checklist template seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding checklists:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run seeding if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedChecklists();
}

export { seedChecklists };

