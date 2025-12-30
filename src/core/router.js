// src/core/router.js

/**
 * A simple hash-based router to manage page visibility.
 * It shows the section corresponding to the hash and hides others.
 */
const createRouter = () => {
  const routes = {};
  let currentRoute = null;

  const register = (hash, element) => {
    routes[hash] = element;
  };

  const navigate = (hash) => {
    // Early exit if route doesn't exist
    if (!routes[hash]) {
      console.warn(`Router.navigate: route "${hash}" is not registered`);
      return;
    }

    if (currentRoute && routes[currentRoute]) {
      routes[currentRoute].classList.remove("active");
    }

    routes[hash].classList.add("active");
    currentRoute = hash;

    // Only push hash if it's different (avoids redundant history entries/events)
    if (window.location.hash.slice(1) !== hash) {
      window.location.hash = hash;
    }
  };

  const handleHashChange = () => {
    let hash = window.location.hash.slice(1);
    if (!hash || !routes[hash]) {
      // Fall back to first registered route
      hash = Object.keys(routes)[0] || "dashboard";
    }
    navigate(hash);
  };

  const start = () => {
    window.addEventListener("hashchange", handleHashChange);
    handleHashChange(); // Initial route
  };

  const reset = () => {
    // Clean up active class from current route
    if (currentRoute && routes[currentRoute]) {
      routes[currentRoute].classList.remove("active");
    }

    window.removeEventListener("hashchange", handleHashChange);
    for (const key in routes) {
      delete routes[key];
    }
    currentRoute = null;
  };

  return {
    register,
    navigate,
    start,
    reset,
  };
};

const router = createRouter();

export default router;
