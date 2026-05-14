import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
import { Router } from "./Router.tsx"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { Toaster } from "@/components/ui/sonner"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <Router />
      <Toaster />
    </ThemeProvider>
  </StrictMode>
)
