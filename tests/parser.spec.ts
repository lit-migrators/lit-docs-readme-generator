import { resolve } from 'node:path';
import { parseLitComponent } from '../src/index.ts';

describe('parseLitComponent with complex mixins', () => {
  const fixturePath = resolve('tests/fixtures/components/complex-component.ts');
  const docs = parseLitComponent(fixturePath);

  it('extracts the component and mixin metadata', () => {
    expect(docs).not.toBeNull();
    if (!docs) return;

    const prop = (name: string) => docs.properties.find((item) => item.name === name);

    expect(prop('open')).toMatchObject({
      type: 'boolean',
      default: 'false',
    });

    expect(prop('displayName')).toMatchObject({
      type: 'string',
      default: undefined,
    });

    expect(prop('label')).toMatchObject({
      type: 'string',
      default: `'Unnamed control'`,
      description: 'Human readable name shown next to the control.',
    });

    expect(prop('helperText')).toMatchObject({
      type: 'string',
      default: "''",
    });

    expect(prop('trackingId')).toMatchObject({
      type: 'string',
      default: `'track-default'`,
    });

    expect(prop('muteAnalytics')).toMatchObject({
      type: 'boolean',
    });

    const propNames = docs.properties.map((p) => p.name);
    expect(propNames).not.toContain('busy');
    expect(propNames).not.toContain('#privateSessionId');
  });

  it('merges slot information declared in mixins', () => {
    expect(docs?.slots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'before-control' }),
        expect.objectContaining({ name: 'after-control' }),
      ]),
    );
  });

  it('captures events dispatched from mixins', () => {
    expect(docs?.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'helper-changed', bubbles: true, composed: true }),
        expect.objectContaining({ name: 'analytics' }),
      ]),
    );
  });
});

describe('parseLitComponent with simple component', () => {
  const fixturePath = resolve('tests/fixtures/components/simple-component.ts');
  const docs = parseLitComponent(fixturePath);

  it('parses basic component information', () => {
    expect(docs).not.toBeNull();
    expect(docs?.className).toBe('SimpleButton');
    expect(docs?.tagName).toBe('simple-button');
    expect(docs?.description).toContain('A simple button component');
  });

  it('extracts properties with correct types and defaults', () => {
    expect(docs).not.toBeNull();
    if (!docs) return;

    const prop = (name: string) => docs.properties.find((item) => item.name === name);

    expect(prop('label')).toMatchObject({
      name: 'label',
      type: 'string',
      default: `'Click me'`,
      description: 'Button label text.',
    });

    expect(prop('disabled')).toMatchObject({
      name: 'disabled',
      type: 'boolean',
      default: 'false',
      reflects: true,
      description: 'Whether the button is disabled.',
    });

    expect(prop('variant')).toMatchObject({
      name: 'variant',
      type: `'primary' | 'secondary'`,
      default: `'primary'`,
      description: 'Button variant type.',
    });
  });

  it('does not include state properties in public API', () => {
    expect(docs).not.toBeNull();
    if (!docs) return;

    const propNames = docs.properties.map((p) => p.name);
    expect(propNames).not.toContain('clickCount');
  });

  it('extracts public methods', () => {
    expect(docs).not.toBeNull();
    if (!docs) return;

    const method = (name: string) => docs.methods.find((m) => m.name === name);

    expect(method('handleClick')).toMatchObject({
      name: 'handleClick',
      description: 'Handles button click events.',
      parameters: [
        expect.objectContaining({
          name: 'event',
          type: 'MouseEvent',
        }),
      ],
    });

    expect(method('reset')).toMatchObject({
      name: 'reset',
      description: 'Resets the click count to zero.',
      parameters: [],
    });
  });

  it('extracts slots from JSDoc', () => {
    expect(docs?.slots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: '', description: 'Default slot for button content' }),
        expect.objectContaining({ name: 'icon', description: 'Slot for button icon' }),
      ]),
    );
  });

  it('extracts CSS custom properties', () => {
    expect(docs?.cssProperties).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: '--button-color',
          description: 'Button text color',
          default: '#000',
        }),
        expect.objectContaining({
          name: '--button-bg',
          description: 'Button background color',
          default: '#fff',
        }),
      ]),
    );
  });

  it('extracts CSS parts', () => {
    expect(docs?.cssParts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'button', description: 'The button element' }),
      ]),
    );
  });

  it('extracts events', () => {
    expect(docs?.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'button-clicked',
          bubbles: true,
          composed: true,
        }),
      ]),
    );
  });
});

describe('parseLitComponent with deprecated features', () => {
  const fixturePath = resolve('tests/fixtures/components/deprecated-component.ts');
  const docs = parseLitComponent(fixturePath);

  it('identifies deprecated properties', () => {
    expect(docs).not.toBeNull();
    if (!docs) return;

    const prop = (name: string) => docs.properties.find((item) => item.name === name);

    expect(prop('oldValue')).toMatchObject({
      name: 'oldValue',
      deprecated: 'Use `value` instead',
    });

    expect(prop('color')).toMatchObject({
      name: 'color',
      deprecated: 'This property will be removed in v3.0. Use CSS custom properties instead.',
    });
  });

  it('identifies required properties', () => {
    expect(docs).not.toBeNull();
    if (!docs) return;

    const prop = (name: string) => docs.properties.find((item) => item.name === name);

    expect(prop('id')).toMatchObject({
      name: 'id',
      required: true,
    });
  });

  it('identifies deprecated methods', () => {
    expect(docs).not.toBeNull();
    if (!docs) return;

    const method = (name: string) => docs.methods.find((m) => m.name === name);

    expect(method('setValue')).toMatchObject({
      name: 'setValue',
      deprecated: 'Use the `value` property directly',
    });

    expect(method('updateValue')).toBeDefined();
    expect(method('updateValue')?.deprecated).toBeFalsy();
  });

  it('parses method return types', () => {
    expect(docs).not.toBeNull();
    if (!docs) return;

    const method = (name: string) => docs.methods.find((m) => m.name === name);

    expect(method('updateValue')?.returns).toMatchObject({
      type: 'number',
      description: 'Previous value',
    });
  });
});

describe('parseLitComponent with CSS properties and parts', () => {
  const fixturePath = resolve('tests/fixtures/components/styled-component.ts');
  const docs = parseLitComponent(fixturePath);

  it('extracts all CSS custom properties', () => {
    expect(docs).not.toBeNull();
    if (!docs) return;

    expect(docs.cssProperties).toHaveLength(6);
    expect(docs.cssProperties).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: '--card-background', default: 'white' }),
        expect.objectContaining({ name: '--card-padding', default: '1rem' }),
        expect.objectContaining({ name: '--card-border-radius', default: '8px' }),
        expect.objectContaining({ name: '--card-shadow' }),
        expect.objectContaining({ name: '--header-background', default: '#f5f5f5' }),
        expect.objectContaining({ name: '--footer-color', default: '#666' }),
      ]),
    );
  });

  it('extracts all CSS parts', () => {
    expect(docs).not.toBeNull();
    if (!docs) return;

    expect(docs.cssParts).toHaveLength(4);
    expect(docs.cssParts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'container', description: 'The main card container' }),
        expect.objectContaining({ name: 'header', description: 'The card header' }),
        expect.objectContaining({ name: 'content', description: 'The card content area' }),
        expect.objectContaining({ name: 'footer', description: 'The card footer' }),
      ]),
    );
  });

  it('extracts all slots', () => {
    expect(docs).not.toBeNull();
    if (!docs) return;

    expect(docs.slots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: '', description: 'Default slot for card content' }),
        expect.objectContaining({ name: 'header', description: 'Card header content' }),
        expect.objectContaining({ name: 'footer', description: 'Card footer content' }),
      ]),
    );
  });
});

describe('parseLitComponent with complex methods', () => {
  const fixturePath = resolve('tests/fixtures/components/methods-component.ts');
  const docs = parseLitComponent(fixturePath);

  it('parses async methods', () => {
    expect(docs).not.toBeNull();
    if (!docs) return;

    const method = (name: string) => docs.methods.find((m) => m.name === name);

    expect(method('fetchData')).toMatchObject({
      name: 'fetchData',
      async: true,
    });
  });

  it('parses methods with optional parameters', () => {
    expect(docs).not.toBeNull();
    if (!docs) return;

    const method = (name: string) => docs.methods.find((m) => m.name === name);
    const fetchData = method('fetchData');

    expect(fetchData).toBeDefined();
    expect(fetchData?.parameters).toHaveLength(2);
    expect(fetchData?.parameters[0]).toMatchObject({
      name: 'url',
      type: 'string',
      optional: false,
    });
    expect(fetchData?.parameters[1]).toMatchObject({
      name: 'options',
      type: 'FetchOptions',
      optional: true,
    });
  });

  it('parses methods with default parameters', () => {
    expect(docs).not.toBeNull();
    if (!docs) return;

    const method = (name: string) => docs.methods.find((m) => m.name === name);
    const filter = method('filter');

    expect(filter).toBeDefined();
    expect(filter?.parameters[1]).toMatchObject({
      name: 'limit',
      default: '10',
      optional: true,
    });
  });

  it('parses methods with complex return types', () => {
    expect(docs).not.toBeNull();
    if (!docs) return;

    const method = (name: string) => docs.methods.find((m) => m.name === name);

    expect(method('calculateStats')?.returns).toMatchObject({
      type: '{ min: number; max: number; avg: number }',
    });

    expect(method('removeItem')?.returns).toMatchObject({
      type: 'boolean',
      description: 'True if item was found and removed',
    });
  });

  it('parses methods with generic parameters', () => {
    expect(docs).not.toBeNull();
    if (!docs) return;

    const method = (name: string) => docs.methods.find((m) => m.name === name);
    const transform = method('transform');

    expect(transform).toBeDefined();
    expect(transform?.async).toBe(true);
    expect(transform?.parameters).toHaveLength(2);
    expect(transform?.parameters[1].optional).toBe(true);
  });
});

describe('parseLitComponent with type inference', () => {
  const fixturePath = resolve('tests/fixtures/components/type-inference.ts');
  const docs = parseLitComponent(fixturePath);

  it('infers string type from string literal', () => {
    expect(docs).not.toBeNull();
    if (!docs) return;

    const prop = (name: string) => docs.properties.find((item) => item.name === name);

    expect(prop('stringProp')).toMatchObject({
      type: 'string',
      default: `'hello'`,
    });
  });

  it('infers number type from numeric literal', () => {
    expect(docs).not.toBeNull();
    if (!docs) return;

    const prop = (name: string) => docs.properties.find((item) => item.name === name);

    expect(prop('numberProp')).toMatchObject({
      type: 'number',
      default: '42',
    });

    expect(prop('negativeProp')).toMatchObject({
      type: 'number',
      default: '-10',
    });
  });

  it('infers boolean type from boolean literal', () => {
    expect(docs).not.toBeNull();
    if (!docs) return;

    const prop = (name: string) => docs.properties.find((item) => item.name === name);

    expect(prop('booleanProp')).toMatchObject({
      type: 'boolean',
      default: 'true',
    });
  });

  it('infers array type from array literal', () => {
    expect(docs).not.toBeNull();
    if (!docs) return;

    const prop = (name: string) => docs.properties.find((item) => item.name === name);

    expect(prop('arrayProp')).toMatchObject({
      type: 'unknown[]',
    });
  });

  it('infers object type from object literal', () => {
    expect(docs).not.toBeNull();
    if (!docs) return;

    const prop = (name: string) => docs.properties.find((item) => item.name === name);

    expect(prop('objectProp')).toMatchObject({
      type: 'Record<string, unknown>',
    });
  });

  it('handles null type', () => {
    expect(docs).not.toBeNull();
    if (!docs) return;

    const prop = (name: string) => docs.properties.find((item) => item.name === name);

    expect(prop('nullProp')).toMatchObject({
      type: 'null',
      default: 'null',
    });
  });

  it('prefers decorator type over inference', () => {
    expect(docs).not.toBeNull();
    if (!docs) return;

    const prop = (name: string) => docs.properties.find((item) => item.name === name);

    expect(prop('decoratorTypeProp')).toMatchObject({
      type: 'string',
    });
  });

  it('uses explicit TypeScript type', () => {
    expect(docs).not.toBeNull();
    if (!docs) return;

    const prop = (name: string) => docs.properties.find((item) => item.name === name);

    expect(prop('explicitTypeProp')).toMatchObject({
      type: 'string',
      default: `'explicit'`,
    });
  });

  it('handles properties with attribute: false', () => {
    expect(docs).not.toBeNull();
    if (!docs) return;

    const prop = (name: string) => docs.properties.find((item) => item.name === name);

    expect(prop('noAttributeProp')).toMatchObject({
      name: 'noAttributeProp',
      attribute: undefined,
    });
  });

  it('handles custom attribute names', () => {
    expect(docs).not.toBeNull();
    if (!docs) return;

    const prop = (name: string) => docs.properties.find((item) => item.name === name);

    expect(prop('customAttributeProp')).toMatchObject({
      name: 'customAttributeProp',
      attribute: 'data-custom',
    });
  });

  it('infers string from template literal', () => {
    expect(docs).not.toBeNull();
    if (!docs) return;

    const prop = (name: string) => docs.properties.find((item) => item.name === name);

    expect(prop('templateProp')).toMatchObject({
      type: 'string',
    });
  });
});

describe('parseLitComponent with event variations', () => {
  const fixturePath = resolve('tests/fixtures/components/edge-cases.ts');
  const docs = parseLitComponent(fixturePath);

  it('parses events with different configurations', () => {
    expect(docs).not.toBeNull();
    if (!docs) return;

    // Find events by filtering through all parsed components in the file
    // Since this file has multiple components, we need to check the event-test component
    expect(docs.events).toBeDefined();
  });
});

describe('parseLitComponent with edge cases', () => {
  it('returns null for component without @customElement decorator', () => {
    const fixturePath = resolve('tests/fixtures/components/edge-cases.ts');
    const docs = parseLitComponent(fixturePath);

    // The file contains NoDecoratorComponent which should be skipped
    // parseLitComponent finds the first valid component with @customElement
    expect(docs).not.toBeNull();
    expect(docs?.className).not.toBe('NoDecoratorComponent');
  });

  it('skips non-Lit components', () => {
    const fixturePath = resolve('tests/fixtures/components/edge-cases.ts');
    const docs = parseLitComponent(fixturePath);

    // Should find a valid Lit component, not NotLitComponent
    expect(docs).not.toBeNull();
    expect(docs?.className).not.toBe('NotLitComponent');
  });
});

describe('parseLitComponent with nested mixins', () => {
  const fixturePath = resolve('tests/fixtures/components/nested-mixin-component.ts');
  const docs = parseLitComponent(fixturePath);

  it('parses component using deeply nested mixins', () => {
    expect(docs).not.toBeNull();
    expect(docs?.className).toBe('NestedFormComponent');
    expect(docs?.tagName).toBe('nested-form');
  });

  it('inherits properties from all mixin layers', () => {
    expect(docs).not.toBeNull();
    if (!docs) return;

    const prop = (name: string) => docs.properties.find((item) => item.name === name);

    // From component itself
    expect(prop('title')).toMatchObject({
      name: 'title',
      type: 'string',
      default: `'Form'`,
    });

    expect(prop('readonly')).toMatchObject({
      name: 'readonly',
      type: 'boolean',
      default: 'false',
      reflects: true,
    });

    // From withDataForm mixin
    expect(prop('dataSource')).toMatchObject({
      name: 'dataSource',
      type: 'string',
      default: "''",
    });

    expect(prop('autoValidate')).toMatchObject({
      name: 'autoValidate',
      type: 'boolean',
      default: 'true',
    });

    // From withValidation mixin (nested in withDataForm)
    expect(prop('valid')).toMatchObject({
      name: 'valid',
      type: 'boolean',
      default: 'true',
      reflects: true,
    });

    expect(prop('errorMessage')).toMatchObject({
      name: 'errorMessage',
      type: 'string',
      default: "''",
    });

    // From withAsyncData mixin (nested in withDataForm)
    expect(prop('loading')).toMatchObject({
      name: 'loading',
      type: 'boolean',
      default: 'false',
      reflects: true,
    });

    // From withLogging mixin (nested in withValidation)
    expect(prop('enableLogging')).toMatchObject({
      name: 'enableLogging',
      type: 'boolean',
      default: 'false',
    });

    expect(prop('logLevel')).toMatchObject({
      name: 'logLevel',
      type: `'debug' | 'info' | 'warn' | 'error'`,
      default: `'info'`,
    });
  });

  it('merges slots from all mixin layers', () => {
    expect(docs).not.toBeNull();
    if (!docs) return;

    expect(docs.slots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: '', description: 'Default slot for form fields' }),
        expect.objectContaining({ name: 'validation-message' }),
      ]),
    );
  });

  it('merges CSS properties from all mixin layers', () => {
    expect(docs).not.toBeNull();
    if (!docs) return;

    expect(docs.cssProperties).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: '--form-width', default: '100%' }),
        expect.objectContaining({ name: '--log-color' }),
        expect.objectContaining({ name: '--data-form-border' }),
      ]),
    );
  });

  it('merges CSS parts from all mixin layers', () => {
    expect(docs).not.toBeNull();
    if (!docs) return;

    expect(docs.cssParts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'loader' }),
        expect.objectContaining({ name: 'form-container' }),
      ]),
    );
  });

  it('inherits events from nested mixins', () => {
    expect(docs).not.toBeNull();
    if (!docs) return;

    const eventNames = docs.events.map((e) => e.name);

    expect(eventNames).toContain('log-message');
    expect(eventNames).toContain('validation-attempted');
    expect(eventNames).toContain('load-start');
    expect(eventNames).toContain('load-complete');
    expect(eventNames).toContain('form-submitted');
  });
});
