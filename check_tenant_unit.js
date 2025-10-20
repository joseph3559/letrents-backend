const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTenantUnit() {
  try {
    const tenant = await prisma.user.findUnique({
      where: { id: '469eee10-2bf5-48c4-b7b8-dac2144ace63' },
      include: {
        tenant_profile: {
          include: {
            current_unit: {
              include: {
                property: true
              }
            },
            current_property: true
          }
        }
      }
    });

    console.log('Tenant Data:', JSON.stringify(tenant, null, 2));
    
    // Also check if any unit has this tenant assigned
    const units = await prisma.unit.findMany({
      where: {
        current_tenant_id: '469eee10-2bf5-48c4-b7b8-dac2144ace63'
      },
      include: {
        property: true
      }
    });
    
    console.log('\nUnits assigned to this tenant:', JSON.stringify(units, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTenantUnit();
