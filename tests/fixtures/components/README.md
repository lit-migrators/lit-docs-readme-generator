# event-test

Component with complex event scenarios.

## Usage

```html
<event-test></event-test>
```

## Events

| Event | Description | Type |
| ----- | ----------- | ---- |
| `simple-event` |  | `CustomEvent<any>` |
| `detail-event` |  | `CustomEvent<any>` |
| `non-bubbling` |  | `CustomEvent<any>` |
| `cancelable-event` |  _(bubbles, cancelable)_ | `CustomEvent<any>` |

## Methods

### `triggerSimple(...)`

Triggers a simple event.

#### Signature

```typescript
triggerSimple(): void
```

#### Returns

Type: `void`


### `triggerWithDetail(...)`

Triggers event with detail.

#### Signature

```typescript
triggerWithDetail(): void
```

#### Returns

Type: `void`


### `triggerNonBubbling(...)`

Triggers non-bubbling event.

#### Signature

```typescript
triggerNonBubbling(): void
```

#### Returns

Type: `void`


### `triggerCancelable(...)`

Triggers cancelable event.

#### Signature

```typescript
triggerCancelable(): void
```

#### Returns

Type: `void`


---

*Built with [Lit](https://lit.dev/)*
