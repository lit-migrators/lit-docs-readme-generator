/**
 * Type definitions for Lit documentation generator
 */

/**
 * Parsed Lit component metadata
 */
export interface LitComponentDocs {
  /** Component class name */
  className: string;
  /** Custom element tag name */
  tagName: string;
  /** Component description from JSDoc */
  description?: string;
  /** Component usage examples */
  usage?: string[];
  /** Properties/attributes */
  properties: PropertyDocs[];
  /** Events emitted by the component */
  events: EventDocs[];
  /** Public methods */
  methods: MethodDocs[];
  /** Slots available */
  slots: SlotDocs[];
  /** CSS custom properties */
  cssProperties: CssPropertyDocs[];
  /** CSS shadow parts */
  cssParts: CssPartDocs[];
  /** Component dependencies */
  dependencies?: string[];
  /** File path */
  filePath: string;
}

/**
 * Property/attribute documentation
 */
export interface PropertyDocs {
  /** Property name */
  name: string;
  /** Attribute name (if different from property) */
  attribute?: string;
  /** Property description */
  description?: string;
  /** Property type */
  type: string;
  /** Default value */
  default?: string;
  /** Whether the property reflects to attribute */
  reflects?: boolean;
  /** Whether this is a state (internal) property */
  state?: boolean;
  /** Whether the property is required */
  required?: boolean;
  /** Whether the property is deprecated */
  deprecated?: boolean | string;
}

/**
 * Event documentation
 */
export interface EventDocs {
  /** Event name */
  name: string;
  /** Event description */
  description?: string;
  /** Event detail type */
  detail?: string;
  /** Whether the event bubbles */
  bubbles?: boolean;
  /** Whether the event is composed */
  composed?: boolean;
  /** Whether the event is cancelable */
  cancelable?: boolean;
  /** Whether the event is deprecated */
  deprecated?: boolean | string;
}

/**
 * Method documentation
 */
export interface MethodDocs {
  /** Method name */
  name: string;
  /** Method description */
  description?: string;
  /** Method parameters */
  parameters: ParameterDocs[];
  /** Return type */
  returns?: {
    type: string;
    description?: string;
  };
  /** Whether the method is async */
  async?: boolean;
  /** Whether the method is deprecated */
  deprecated?: boolean | string;
}

/**
 * Parameter documentation
 */
export interface ParameterDocs {
  /** Parameter name */
  name: string;
  /** Parameter type */
  type: string;
  /** Parameter description */
  description?: string;
  /** Whether the parameter is optional */
  optional?: boolean;
  /** Default value */
  default?: string;
}

/**
 * Slot documentation
 */
export interface SlotDocs {
  /** Slot name (empty string for default slot) */
  name: string;
  /** Slot description */
  description?: string;
}

/**
 * CSS custom property documentation
 */
export interface CssPropertyDocs {
  /** Property name */
  name: string;
  /** Property description */
  description?: string;
  /** Default value */
  default?: string;
}

/**
 * CSS shadow part documentation
 */
export interface CssPartDocs {
  /** Part name */
  name: string;
  /** Part description */
  description?: string;
}

/**
 * Generator options
 */
export interface GeneratorOptions {
  /** Glob pattern(s) for files to process */
  pattern: string | string[];
  /** Whether to overwrite existing README files */
  overwrite?: boolean;
  /** Custom template function */
  template?: (docs: LitComponentDocs) => string;
  /** Whether to include usage examples */
  includeUsage?: boolean;
}

/**
 * Stencil.js JSDoc tags
 */
export interface StencilTags {
  /** @slot - Slot documentation */
  slot?: string[];
  /** @part - CSS part documentation */
  part?: string[];
  /** @cssprop or @cssproperty - CSS custom property */
  cssprop?: string[];
  cssproperty?: string[];
}
