import { jsx } from 'react/jsx-runtime';
import { Container } from '@radix-ui/themes';

function AuthShell({ children }) {
  return /* @__PURE__ */ jsx(Container, {
    size: "1",
    p: "4",
    style: {
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    },
    children
  });
}

export { AuthShell as A };
//# sourceMappingURL=AuthShell-CESdzkZE.mjs.map
