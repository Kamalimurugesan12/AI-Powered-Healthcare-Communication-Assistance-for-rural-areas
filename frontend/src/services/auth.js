// auth api calls
export const authService = {
  login: async ({ email, password }) => {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Frontend-only authentication
    localStorage.setItem("isLoggedIn", "true");
    localStorage.setItem(
      "user",
      JSON.stringify({
        email,
      })
    );

    return {
      success: true,
      user: {
        email,
      },
    };
  },

  logout: () => {
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("user");
  },
};