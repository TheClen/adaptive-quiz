import type { QuizFixture } from "./types.js";

/** A React session: what the API returns for each of the 10 positions. */
export const react: QuizFixture = {
  topic: "react",
  questions: [
    {
      conceptId: "jsx-and-rendering",
      conceptLabel: "JSX and rendering",
      question: {
        kind: "single",
        prompt: "What does this component render when `count` is 0?",
        snippet: {
          language: "jsx",
          source: [
            "function Badge({ count }) {",
            "  return <div>{count && <span>{count} new</span>}</div>;",
            "}",
          ].join("\n"),
        },
        options: [
          { id: "a", text: "An empty div" },
          { id: "b", text: "A div containing 0" },
          { id: "c", text: 'A div containing "0 new"' },
          { id: "d", text: "Nothing at all" },
        ],
        correctOptionId: "b",
        explanation:
          "`0 && …` evaluates to 0, and React renders the number 0. Write `count > 0 && …` to render nothing.",
      },
    },
    {
      conceptId: "components-and-props",
      conceptLabel: "Components and props",
      question: {
        kind: "multiple",
        prompt: "Which values are good keys for the items of this list?",
        snippet: {
          language: "jsx",
          source: [
            "function TodoList({ todos }) {",
            "  return (",
            "    <ul>",
            "      {todos.map((todo) => (",
            "        <li key={todo.id}>{todo.title}</li>",
            "      ))}",
            "    </ul>",
            "  );",
            "}",
          ].join("\n"),
        },
        options: [
          { id: "a", text: "todo.id" },
          { id: "b", text: "Math.random()" },
          { id: "c", text: "A slug unique among the todos" },
          { id: "d", text: "The index, when the list can be reordered" },
        ],
        correctOptionIds: ["a", "c"],
        explanation:
          "A key must be stable and unique among siblings. A random value changes on every render, and an index moves with reordering.",
      },
    },
    {
      conceptId: "use-effect",
      conceptLabel: "useEffect",
      question: {
        kind: "single",
        prompt: "When does an effect declared with an empty dependency array run?",
        snippet: null,
        options: [
          { id: "a", text: "Before every render" },
          { id: "b", text: "After every render" },
          { id: "c", text: "After the first render only" },
          { id: "d", text: "Only when the component unmounts" },
        ],
        correctOptionId: "c",
        explanation:
          "With no dependencies, nothing can change between renders, so React runs the effect once after mounting. Its cleanup runs on unmount.",
      },
    },
    {
      conceptId: "reducers",
      conceptLabel: "Reducers",
      question: {
        kind: "code",
        prompt:
          'Write `counterReducer(state, action)` for a `{ count }` state. "increment" adds 1, "decrement" subtracts 1, and any other action returns the state unchanged. Never change `state`.',
        functionName: "counterReducer",
        starterCode: ["function counterReducer(state, action) {", "  return state;", "}"].join(
          "\n",
        ),
        tests: [
          {
            id: "increment",
            description: 'counterReducer({ count: 1 }, { type: "increment" }) returns { count: 2 }',
            args: [{ count: 1 }, { type: "increment" }],
            expected: { count: 2 },
            checksImmutability: true,
          },
          {
            id: "decrement",
            description: 'counterReducer({ count: 1 }, { type: "decrement" }) returns { count: 0 }',
            args: [{ count: 1 }, { type: "decrement" }],
            expected: { count: 0 },
            checksImmutability: true,
          },
          {
            id: "unknown",
            description: 'counterReducer({ count: 5 }, { type: "reset" }) returns { count: 5 }',
            args: [{ count: 5 }, { type: "reset" }],
            expected: { count: 5 },
            checksImmutability: true,
          },
        ],
        referenceSolution: [
          "function counterReducer(state, action) {",
          "  switch (action.type) {",
          '    case "increment":',
          "      return { ...state, count: state.count + 1 };",
          '    case "decrement":',
          "      return { ...state, count: state.count - 1 };",
          "    default:",
          "      return state;",
          "  }",
          "}",
        ].join("\n"),
        explanation:
          "A reducer returns the next state from the current one and an action. Spreading `state` into a new object keeps the update immutable.",
        exerciseToken: "e2e-fixture-counter-reducer",
      },
    },
    {
      conceptId: "refs",
      conceptLabel: "Refs",
      question: {
        kind: "single",
        prompt: "What happens when an event handler sets `ref.current` to a new value?",
        snippet: null,
        options: [
          { id: "a", text: "The component re-renders" },
          { id: "b", text: "The value changes and the component does not re-render" },
          { id: "c", text: "React throws an error" },
          { id: "d", text: "The value is reset on the next render" },
        ],
        correctOptionId: "b",
        explanation:
          "A ref is a mutable box that React keeps between renders. Changing it does not schedule a render.",
      },
    },
    {
      conceptId: "state-and-immutable-updates",
      conceptLabel: "State and immutable updates",
      question: {
        kind: "multiple",
        prompt: "Which calls add `item` to the `items` state so that React re-renders?",
        snippet: null,
        options: [
          { id: "a", text: "setItems([...items, item])" },
          { id: "b", text: "items.push(item); setItems(items)" },
          { id: "c", text: "setItems(items.concat(item))" },
          { id: "d", text: "setItems((previous) => [...previous, item])" },
        ],
        correctOptionIds: ["a", "c", "d"],
        explanation:
          "React compares the new state with the old one. `push` changes the same array, so React sees no change and skips the render.",
      },
    },
    {
      conceptId: "context",
      conceptLabel: "Context",
      question: {
        kind: "single",
        prompt: "Which components re-render when the value of a context provider changes?",
        snippet: null,
        options: [
          { id: "a", text: "Every component in the application" },
          { id: "b", text: "Only the provider itself" },
          { id: "c", text: "The components below the provider that read the context" },
          { id: "d", text: "None until the page is reloaded" },
        ],
        correctOptionId: "c",
        explanation:
          "React re-renders the components that read the context with `useContext`, even when their parents are memoized.",
      },
    },
    {
      conceptId: "derived-state-and-selectors",
      conceptLabel: "Derived state and selectors",
      question: {
        kind: "code",
        prompt:
          'Write `visibleTodos(todos, filter)`, which returns the todos to show: all of them for "all", the done ones for "done", the others for "active". Never change `todos`.',
        functionName: "visibleTodos",
        starterCode: ["function visibleTodos(todos, filter) {", "  return todos;", "}"].join("\n"),
        tests: [
          {
            id: "all",
            description: 'visibleTodos(todos, "all") returns every todo',
            args: [
              [
                { id: 1, done: true },
                { id: 2, done: false },
              ],
              "all",
            ],
            expected: [
              { id: 1, done: true },
              { id: 2, done: false },
            ],
            checksImmutability: true,
          },
          {
            id: "done",
            description: 'visibleTodos(todos, "done") returns the done todos',
            args: [
              [
                { id: 1, done: true },
                { id: 2, done: false },
              ],
              "done",
            ],
            expected: [{ id: 1, done: true }],
            checksImmutability: true,
          },
          {
            id: "active",
            description: 'visibleTodos(todos, "active") returns the todos not done',
            args: [
              [
                { id: 1, done: true },
                { id: 2, done: false },
              ],
              "active",
            ],
            expected: [{ id: 2, done: false }],
            checksImmutability: true,
          },
        ],
        referenceSolution: [
          "function visibleTodos(todos, filter) {",
          '  if (filter === "done") return todos.filter((todo) => todo.done);',
          '  if (filter === "active") return todos.filter((todo) => !todo.done);',
          "  return todos;",
          "}",
        ].join("\n"),
        explanation:
          "The visible todos derive from the list and the filter, so they are computed while rendering rather than kept in their own state.",
        exerciseToken: "e2e-fixture-visible-todos",
      },
    },
    {
      conceptId: "memoization",
      conceptLabel: "Memoization",
      question: {
        kind: "multiple",
        prompt: "Which statements about `useMemo` are true?",
        snippet: null,
        options: [
          { id: "a", text: "It caches a computed value between renders" },
          { id: "b", text: "It recomputes when a dependency changes" },
          { id: "c", text: "It prevents the component from re-rendering" },
          { id: "d", text: "It runs its function after the render, like an effect" },
        ],
        correctOptionIds: ["a", "b"],
        explanation:
          "`useMemo` computes during render and reuses the result while its dependencies stay the same. It does not stop renders: `memo` does that for components.",
      },
    },
    {
      conceptId: "custom-hooks",
      conceptLabel: "Custom hooks",
      question: {
        kind: "single",
        prompt: "What must the name of a custom hook start with?",
        snippet: null,
        options: [
          { id: "a", text: "use" },
          { id: "b", text: "hook" },
          { id: "c", text: "A capital letter" },
          { id: "d", text: "Nothing: any name works the same way" },
        ],
        correctOptionId: "a",
        explanation:
          "The `use` prefix tells React and its lint rules that the function calls hooks, so the rules of hooks can be checked.",
      },
    },
  ],
  reviews: {
    counterReducer: {
      summary: "A clear reducer that never changes its state.",
      comments: [
        { aspect: "correctness", text: "Unknown actions return the state unchanged." },
        { aspect: "idiomatic", text: "A `switch` on `action.type` is the usual reducer shape." },
      ],
    },
    visibleTodos: {
      summary: "The filter is ignored, so every todo is returned.",
      comments: [
        { aspect: "correctness", text: 'Handle "done" and "active" with `filter`.' },
        { aspect: "readability", text: "One early return per filter keeps the cases apart." },
      ],
    },
  },
};
