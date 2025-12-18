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
    // If we are already on this hash (and it's not a forced re-nav), we might want to just ensure classes are set
    // But for simplicity, we'll just update the classes.

    if (currentRoute && routes[currentRoute]) {
      routes[currentRoute].classList.remove("active");
    }

    if (routes[hash]) {
      routes[hash].classList.add("active");
      currentRoute = hash;

      // Only push hash if it's different (avoids redundant history entries/events)
      if (window.location.hash.slice(1) !== hash) {
        window.location.hash = hash;
      }
    }
  };

  const handleHashChange = () => {
    const hash = window.location.hash.slice(1) || "dashboard"; // Default route
    navigate(hash);
  };

  const start = () => {
    window.addEventListener("hashchange", handleHashChange);
    handleHashChange(); // Initial route
  };

  const reset = () => {
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
