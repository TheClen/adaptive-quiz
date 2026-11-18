import {
  conceptIdsByTopic,
  type JavaScriptConceptId,
  type ReactConceptId,
  type TopicId,
} from "@ai-in-learning/shared-types";

/** What `core` knows about a concept besides its id (plan §6.3). */
export interface ConceptInfo {
  /** Short name shown to the visitor and sent to the model. */
  readonly label: string;
  /** What the concept covers, sent to the model with the label. */
  readonly description: string;
  /**
   * True when the concept can be tested by a code exercise: a synchronous pure
   * function with JSON arguments and a JSON result (AC-3.7).
   */
  readonly exercise: boolean;
}

/** A concept of a topic, with its id. */
export interface Concept<Id extends string = string> extends ConceptInfo {
  readonly id: Id;
}

const javascriptConcepts = {
  "scope-and-hoisting": {
    label: "Scope and hoisting",
    description: "`let`/`const`/`var`, block scope, hoisting, temporal dead zone",
    exercise: false,
  },
  "types-and-coercion": {
    label: "Types and coercion",
    description: "primitive types, `typeof`, implicit coercion, `==` vs `===`",
    exercise: true,
  },
  functions: {
    label: "Functions",
    description: "declarations vs expressions, arrow functions, default and rest parameters",
    exercise: true,
  },
  closures: {
    label: "Closures",
    description: "lexical scope, functions capturing variables, factories",
    exercise: false,
  },
  "this-binding": {
    label: "this binding",
    description: "`this` rules, `call`/`apply`/`bind`, arrow functions and `this`",
    exercise: false,
  },
  "prototypes-and-classes": {
    label: "Prototypes and classes",
    description: "prototype chain, `class` syntax, inheritance",
    exercise: false,
  },
  "array-methods": {
    label: "Array methods",
    description: "`map`, `filter`, `reduce`, `find`, `some`, `sort`",
    exercise: true,
  },
  "objects-and-destructuring": {
    label: "Objects and destructuring",
    description: "object literals, destructuring, spread and rest, optional chaining, `??`",
    exercise: true,
  },
  "immutability-and-copying": {
    label: "Immutability and copying",
    description: "values vs references, shallow vs deep copies",
    exercise: true,
  },
  strings: {
    label: "Strings",
    description: "string methods, template literals, basic regular expressions",
    exercise: true,
  },
  "maps-and-sets": {
    label: "Maps and sets",
    description: "`Map`, `Set`, when to use them instead of objects and arrays",
    exercise: true,
  },
  "error-handling": {
    label: "Error handling",
    description: "`try`/`catch`/`finally`, error types, throwing",
    exercise: false,
  },
  promises: {
    label: "Promises",
    description: "creating and chaining promises, `Promise.all` and friends",
    exercise: false,
  },
  "async-await": {
    label: "Async/await",
    description: "`async` functions, `await`, error handling in async code",
    exercise: false,
  },
  "event-loop": {
    label: "Event loop",
    description: "call stack, task and microtask queues, ordering of callbacks",
    exercise: false,
  },
  "iterators-and-generators": {
    label: "Iterators and generators",
    description: "iteration protocol, `for...of`, generator functions",
    exercise: false,
  },
  modules: {
    label: "Modules",
    description: "ES modules, named and default exports, live bindings",
    exercise: false,
  },
} as const satisfies Record<JavaScriptConceptId, ConceptInfo>;

const reactConcepts = {
  "jsx-and-rendering": {
    label: "JSX and rendering",
    description: "JSX expressions, conditional rendering",
    exercise: false,
  },
  "components-and-props": {
    label: "Components and props",
    description: "function components, props, children, composition",
    exercise: false,
  },
  "state-and-immutable-updates": {
    label: "State and immutable updates",
    description: "`useState`, updating objects and arrays without mutation",
    exercise: true,
  },
  reducers: {
    label: "Reducers",
    description: "`useReducer`, reducer functions, action shapes",
    exercise: true,
  },
  "derived-state-and-selectors": {
    label: "Derived state and selectors",
    description: "computing values from state instead of storing them",
    exercise: true,
  },
  "events-and-forms": {
    label: "Events and forms",
    description: "event handlers, controlled inputs, form validation logic",
    exercise: true,
  },
  "use-effect": {
    label: "useEffect",
    description: "effects, dependency arrays, cleanup",
    exercise: false,
  },
  memoization: {
    label: "Memoization",
    description: "`useMemo`, `useCallback`, `React.memo`",
    exercise: false,
  },
  refs: {
    label: "Refs",
    description: "`useRef`, refs to DOM nodes and mutable values",
    exercise: false,
  },
  context: {
    label: "Context",
    description: "`createContext`, providers, `useContext`",
    exercise: false,
  },
  "custom-hooks": {
    label: "Custom hooks",
    description: "extracting reusable stateful logic",
    exercise: false,
  },
  "lifting-state-up": {
    label: "Lifting state up",
    description: "sharing state between components",
    exercise: false,
  },
  "rendering-behavior": {
    label: "Rendering behavior",
    description: "when components re-render, reconciliation, keys in lists",
    exercise: false,
  },
} as const satisfies Record<ReactConceptId, ConceptInfo>;

/** Concept details by topic and id. The key sets match the `shared-types` enums. */
export const CATALOGUE = {
  javascript: javascriptConcepts,
  react: reactConcepts,
} as const satisfies {
  javascript: Record<JavaScriptConceptId, ConceptInfo>;
  react: Record<ReactConceptId, ConceptInfo>;
};

/** The concept id type of a topic. */
export type ConceptIdOf<T extends TopicId> = keyof (typeof CATALOGUE)[T] & string;

/** The concepts of a topic, in the order of its `shared-types` enum. */
export function conceptsOf<T extends TopicId>(topic: T): readonly Concept<ConceptIdOf<T>>[] {
  const details: Readonly<Record<string, ConceptInfo>> = CATALOGUE[topic];
  return conceptIdsByTopic[topic].options.map((id) => {
    const info = details[id];
    if (info === undefined) {
      throw new Error(`Concept "${id}" of topic "${topic}" is missing from the catalogue`);
    }
    return { id: id as ConceptIdOf<T>, ...info };
  });
}

/** The concept `conceptId` of `topic`, or `undefined` when it does not belong to it. */
export function findConcept<T extends TopicId>(
  topic: T,
  conceptId: string,
): Concept<ConceptIdOf<T>> | undefined {
  return conceptsOf(topic).find((concept) => concept.id === conceptId);
}
