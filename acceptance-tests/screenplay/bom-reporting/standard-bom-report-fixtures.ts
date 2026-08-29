import { DataTable } from '@cucumber/cucumber';
import { actorCalled } from '@serenity-js/core';
import { GetRequest, LastResponse, PostRequest, Send } from '@serenity-js/rest';
import { RegisteredProduct } from '../bom-registration/product-details';
import { rememberRegisteredStandardBom } from '../bom-registration/standard-bom-details';
import { LogInAsPersona } from '../common/personas';

/**
 * Test-data setup for `reporting-standard-bom.feature`'s own background — "اینکه آنالیز های استاندارد زیر
 * با اجزا و مواد اولیه شان در سیستم ثبت شده باشند".
 *
 * Mirrors `bom-report-fixtures.ts` for the daily BOM feature, but stops at two tiers (product + standard
 * BOM) instead of three — there are no daily BOMs in this feature, only the registered standard BOMs
 * themselves. Products are unique by name (`registring-product.feature`'s own rule), so a name already
 * seen by an earlier group is the SAME product, registered once with the union of that product's
 * components across all groups that share it.
 *
 * Standard BOM registration requires SystemAdmin or Management role — so the fixture runs as یاشار
 * (the admin persona seeded in the test DB).
 */

interface BackgroundBomGroup {
  miCode: string;
  productName: string;
  brand: string;
  standardLength: string;
  active: string;
  description: string;
  components: Array<{
    name: string;
    materials: Array<{ name: string; weight: number }>;
  }>;
}

const MI_CODE = 'کد MI';
const PRODUCT_NAME = 'نام محصول';
const BRAND = 'برند';
const STANDARD_LENGTH = 'متراژ استاندارد';
const ACTIVE = 'فعال';
const DESCRIPTION = 'توضیحات';
const COMPONENT_NAME = 'نام جز';
const MATERIAL_NAME = 'نام مواد اولیه';
const WEIGHT = 'وزن مواد اولیه';

/** Groups the background table's rows by MI code — every row sharing one MI code is one more
 * component/material line of that same standard BOM (same product, same standard BOM identity). */
const groupBackgroundRows = (table: DataTable): BackgroundBomGroup[] => {
  const groupsByMiCode = new Map<string, BackgroundBomGroup>();
  const orderOfAppearance: string[] = [];

  for (const row of table.hashes()) {
    const miCode = row[MI_CODE];
    let group = groupsByMiCode.get(miCode);
    if (!group) {
      const description = row[DESCRIPTION];
      group = {
        miCode,
        productName: row[PRODUCT_NAME],
        brand: row[BRAND],
        standardLength: row[STANDARD_LENGTH],
        active: row[ACTIVE],
        description: description === '-' ? '' : description,
        components: [],
      };
      groupsByMiCode.set(miCode, group);
      orderOfAppearance.push(miCode);
    }

    const componentName = row[COMPONENT_NAME];
    let component = group.components.find((c) => c.name === componentName);
    if (!component) {
      component = { name: componentName, materials: [] };
      group.components.push(component);
    }
    component.materials.push({
      name: row[MATERIAL_NAME],
      weight: Number(row[WEIGHT]),
    });
  }

  return orderOfAppearance.map((miCode) => groupsByMiCode.get(miCode)!);
};

type ComponentUnion = { name: string; materials: string[] };

/** Computes the union of every group that shares one product name — every distinct component and
 * material that product needs to carry so any group referencing it can select its own subset. */
const unionComponentsByProductName = (
  groups: BackgroundBomGroup[],
): Map<string, ComponentUnion[]> => {
  const unions = new Map<string, ComponentUnion[]>();
  for (const group of groups) {
    let union = unions.get(group.productName);
    if (!union) {
      union = [];
      unions.set(group.productName, union);
    }
    for (const component of group.components) {
      let unionComponent = union.find((c) => c.name === component.name);
      if (!unionComponent) {
        unionComponent = { name: component.name, materials: [] };
        union.push(unionComponent);
      }
      for (const material of component.materials) {
        if (!unionComponent.materials.includes(material.name)) {
          unionComponent.materials.push(material.name);
        }
      }
    }
  }
  return unions;
};

interface ProductResponseBody {
  id: string;
  name: string;
  components: Array<{
    id: string;
    name: string;
    materials: Array<{ id: string; name: string }>;
  }>;
}

interface StandardBomCompositionLine {
  componentId: string;
  componentName: string;
  materials: Array<{
    materialId: string;
    materialName: string;
    weight: number;
  }>;
}

const fetchProduct = async (
  actor: ReturnType<typeof actorCalled>,
  productId: string,
): Promise<ProductResponseBody> => {
  await actor.attemptsTo(Send.a(GetRequest.to('products')));
  const products = await actor.answer(
    LastResponse.body<ProductResponseBody[]>(),
  );
  const found = products.find((p) => p.id === productId);
  if (!found) {
    throw new Error(`Product "${productId}" not found in product list.`);
  }
  return found;
};

const buildGroupComposition = (
  product: ProductResponseBody,
  group: BackgroundBomGroup,
): StandardBomCompositionLine[] => {
  return group.components.map((groupComponent) => {
    const clonedComponent = product.components.find(
      (c) => c.name === groupComponent.name,
    );
    if (!clonedComponent) {
      throw new Error(
        `Component "${groupComponent.name}" not found on product "${product.name}".`,
      );
    }
    const materials = groupComponent.materials.map((groupMaterial) => {
      const clonedMaterial = clonedComponent.materials.find(
        (m) => m.name === groupMaterial.name,
      );
      if (!clonedMaterial) {
        throw new Error(
          `Material "${groupMaterial.name}" of component "${groupComponent.name}" not found on product.`,
        );
      }
      return {
        materialId: clonedMaterial.id,
        materialName: clonedMaterial.name,
        weight: groupMaterial.weight,
      };
    });
    return {
      componentId: clonedComponent.id,
      componentName: clonedComponent.name,
      materials,
    };
  });
};

/** Converts the table's "بله"/"خیر" active string to a boolean. */
const parseActive = (value: string): boolean => {
  if (value === 'بله') return true;
  if (value === 'خیر') return false;
  throw new Error(`Unknown active value: "${value}"`);
};

/** Tracks every MI code the background has registered, in registration order. */
let backgroundMiCodes: string[] = [];

export const theBackgroundMiCodes = (): string[] => backgroundMiCodes;

/**
 * Registers every standard BOM the background table describes — product (once per distinct name), then
 * the standard BOM itself, per group — and remembers their MI codes
 * (`theBackgroundMiCodes`). Runs as a SystemAdmin/Management user (یاشار).
 */
export const registerStandardBomReportFixtures = async (
  table: DataTable,
): Promise<void> => {
  const groups = groupBackgroundRows(table);
  const componentUnionsByProductName = unionComponentsByProductName(groups);
  const productsByName = new Map<string, RegisteredProduct>();
  const miCodes: string[] = [];

  // All operations run as یاشار (the admin persona), who must be seeded in the test DB.
  const admin = actorCalled('یاشار');
  await admin.attemptsTo(LogInAsPersona('یاشار'));

  for (const group of groups) {
    // Register product (once per distinct name)
    let product = productsByName.get(group.productName);
    if (!product) {
      const productComponents = componentUnionsByProductName.get(
        group.productName,
      )!;
      await admin.attemptsTo(
        Send.a(
          PostRequest.to('products').with({
            name: group.productName,
            components: productComponents.map((c) => ({
              name: c.name,
              materials: c.materials.map((m) => ({ name: m })),
            })),
          }),
        ),
      );
      const productResponse = await admin.answer(
        LastResponse.body<{ id: string; name: string }>(),
      );
      product = { id: productResponse.id, name: productResponse.name };
      productsByName.set(group.productName, product);
    }

    // Fetch product to get real component/material IDs
    const productWithComponents = await fetchProduct(admin, product.id);
    const groupComposition = buildGroupComposition(
      productWithComponents,
      group,
    );

    // Register the standard BOM
    await admin.attemptsTo(
      Send.a(
        PostRequest.to('standard-boms').with({
          productId: product.id,
          miCode: group.miCode,
          brand: group.brand,
          standardLength: Number(group.standardLength),
          active: parseActive(group.active),
          ...(group.description !== ''
            ? { description: group.description }
            : {}),
          components: groupComposition.map((c) => ({
            componentId: c.componentId,
            materials: c.materials.map((m) => ({
              materialId: m.materialId,
              weight: m.weight,
            })),
          })),
        }),
      ),
    );

    // Remember as the "last registered" standard BOM
    const standardBomResponse = await admin.answer(
      LastResponse.body<{ id: string }>(),
    );
    rememberRegisteredStandardBom({
      id: standardBomResponse.id,
      miCode: group.miCode,
      productId: product.id,
      productName: group.productName,
    });

    miCodes.push(group.miCode);
  }

  backgroundMiCodes = miCodes;
};
