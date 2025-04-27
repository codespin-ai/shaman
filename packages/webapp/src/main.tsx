import { component } from "magic-loop";
import { initRouter } from "webjsx-router";
import "./styles.css";

// Define a simple Hello World component
component("hello-world", async function* (component) {
  // This is where the component logic goes
  let count = 0;

  while (true) {
    yield (
      <div style="text-align: center; margin-top: 100px;">
        <h1>Hello World from Magic Loop!</h1>
        <p>This is a simple counter example:</p>
        <p>Count: {count}</p>
        <button
          onclick={() => {
            count++;
            component.render();
          }}
          style="padding: 8px 16px; margin-top: 10px;"
        >
          Increment
        </button>
      </div>
    );
  }
});

// Initialize the app when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  const appContainer = document.getElementById("app");

  if (!appContainer) {
    console.error("Could not find app container element");
    return;
  }

  // Initialize router with our hello-world component
  initRouter(appContainer, () => <hello-world />);

  console.log("Magic Loop app initialized!");
});
