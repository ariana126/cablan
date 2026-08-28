import { FindMaterialByNameHandler } from '@materials/application/queries/find-material-by-name/find-material-by-name.handler';
import { ListMaterialsHandler } from '@materials/application/queries/list-materials/list-materials.handler';

export const QueryHandlers = [ListMaterialsHandler, FindMaterialByNameHandler];
