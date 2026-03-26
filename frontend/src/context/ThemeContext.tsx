import React, { createContext, useContext, useState } from 'react';
import { darkColors, lightColors, Colors } from '../constants/colors';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  colors: Colors;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  colors: darkColors,
  toggleTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>('dark');
  const colors = theme === 'dark' ? darkColors : lightColors;
  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  return (
    <ThemeContext.Provider value={{ theme, colors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
