import { Project, SyntaxKind } from 'ts-morph';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const DEFAULT_BASE_URL = 'http://172.30.82.187:3200/api/v1';
const COLLECTION_PATH = path.resolve('src/postman/expentra_collection.json');
const ENV_PATH = path.resolve('src/postman/expentra_environment.json');

const project = new Project({
  tsConfigFilePath: 'tsconfig.json',
  skipFileDependencyResolution: true,
});

// Load all controller files
const controllerFiles = project.addSourceFilesAtPaths('src/**/*.controller.ts');

// Helper to extract route metadata from @Controller and method decorators
function getControllerPrefix(sourceFile) {
  const classDec = sourceFile.getClasses()[0];
  const ctrlDec = classDec?.getDecorator('Controller');
  if (!ctrlDec) return '';
  const args = ctrlDec.getArguments();
  if (args.length === 0) return '';
  const first = args[0];
  // If the argument is a simple string literal
  if (first.getKind() === SyntaxKind.StringLiteral) {
    return first.getText().replace(/[ '\`]/g, '');
  }
  // If the argument is an object literal, extract the 'path' property
  if (first.getKind() === SyntaxKind.ObjectLiteralExpression) {
    const obj = first.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);
    const pathProp = obj.getProperty('path');
    if (pathProp && pathProp.getKindName && pathProp.getKindName() === 'PropertyAssignment') {
      const initializer = pathProp.getInitializer?.();
      if (initializer) {
        return initializer.getText().replace(/[ '\`]/g, '');
      }
    }
    // If no path property, return empty
    return '';
  }
  // Fallback: empty string
  return '';
}

function getMethodInfo(method) {
  const decorators = method.getDecorators();
  const httpDecorator = decorators.find(d => ['Get', 'Post', 'Put', 'Patch', 'Delete', 'Options', 'Head', 'All'].includes(d.getName()));
  if (!httpDecorator) return null;
  const httpMethod = httpDecorator.getName().toUpperCase();
  const pathArg = httpDecorator.getArguments()[0];
  const routePath = pathArg ? pathArg.getText().replace(/[ '\`]/g, '') : '';
  return { httpMethod, routePath };
}

// Build collection skeleton
const collection: any = {
  info: {
    name: 'Expentra API',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    _postman_id: 'generated-' + Date.now(),
  },
  item: [] as any[],
};

// Process each controller
controllerFiles.forEach(file => {
  const prefix = getControllerPrefix(file);
  const classDec = file.getClasses()[0];
  if (!classDec) return;
  const controllerName = classDec.getName() || 'UnnamedController';
  const folder: any = { name: controllerName.replace('Controller', ''), item: [] as any[] };
  classDec.getMethods().forEach(method => {
    const info = getMethodInfo(method);
    if (!info) return;
    
    // Construct the path array by splitting prefix and route path
    const pathSegments = [prefix, info.routePath]
      .filter(p => p)
      .join('/')
      .split('/')
      .filter(p => p);

    const requestUrl = `{{Base-URL}}/${pathSegments.join('/')}`;

    const request = {
      name: method.getName(),
      request: {
        method: info.httpMethod,
        auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{Access-Token}}', type: 'string' }] },
        url: {
          raw: requestUrl,
          host: ['{{Base-URL}}'],
          path: pathSegments
        },
        // Auto-generated sample body from DTO (if any)
        body: (function () {
          const bodyParam = method.getParameters().find(p => p.getDecorator('Body'));
          if (!bodyParam) return undefined;
          // Resolve DTO class reliably
          const type = bodyParam.getType();
          const symbol = type.getSymbol();
          if (!symbol) return undefined;
          const decl = symbol.getDeclarations()?.[0];
          if (!decl) return undefined;
          const dtoClass = decl.asKindOrThrow(SyntaxKind.ClassDeclaration);
          const example: any = {};
          dtoClass.getProperties().forEach(p => {
            if (p.getDecorator('IsEmail')) example[p.getName()] = 'user@example.com';
            else if (p.getDecorator('IsNumber')) example[p.getName()] = 0;
            else example[p.getName()] = 'sample';
          });
          return { mode: 'raw', raw: JSON.stringify(example, null, 2), options: { raw: { language: 'json' } } };
        })(),
        description: `Generated from ${method.getName()} in ${file.getBaseName()}`,
      },
    };
    folder.item.push(request);
  });
  if (folder.item.length) collection.item.push(folder);
});

// Write collection
fs.mkdirSync(path.dirname(COLLECTION_PATH), { recursive: true });
fs.writeFileSync(COLLECTION_PATH, JSON.stringify(collection, null, 2));

// Environment file
const environment = {
  name: 'Expentra',
  values: [
    { key: 'Base-URL', value: DEFAULT_BASE_URL, enabled: true },
    { key: 'Access-Token', value: '<YOUR_TOKEN>', enabled: true },
  ],
};
fs.writeFileSync(ENV_PATH, JSON.stringify(environment, null, 2));

console.log('Postman collection and environment generated successfully.');
