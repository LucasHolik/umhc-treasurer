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
    if (currentRoute) {
      routes[currentRoute].style.display = 'none';
    }
    if (routes[hash]) {
      routes[hash].style.display = 'block';
      currentRoute = hash;
      window.location.hash = hash;
    }
  };

  const handleHashChange = () => {
    const hash = window.location.hash.slice(1) || 'dashboard'; // Default route
    navigate(hash);
  };

  const start = () => {
    window.addEventListener('hashchange', handleHashChange);
    handleHashChange(); // Initial route
  };

  return {
    register,
    navigate,
    start,
  };
};

const router = createRouter();

export default router;
