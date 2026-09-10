import JarvisChatPage from "@/pages/chat/page"
import { Toaster } from "@/components/ui/sonner"
import LoginPage from "@/pages/LoginPage"
import DisclaimerPage from "@/pages/Disclaimer"
import { useState } from "react"

export function App() {
  const [stage, setStage] = useState<"login" | "disclaimer" | "chat">(() => {
    if (sessionStorage.getItem("jchat_disclaimer_accepted") === "true") return "chat"
    if (sessionStorage.getItem("jchat_authenticated") === "true") return "disclaimer"
    return "login"
  })

  const handleLogin = () => {
    sessionStorage.setItem("jchat_authenticated", "true")
    sessionStorage.removeItem("jchat_disclaimer_accepted")
    setStage("disclaimer")
  }

  const handleAcceptDisclaimer = () => {
    sessionStorage.setItem("jchat_disclaimer_accepted", "true")
    setStage("chat")
  }

  const handleLogout = () => {
    sessionStorage.removeItem("jchat_authenticated")
    sessionStorage.removeItem("jchat_disclaimer_accepted")
    setStage("login")
  }

  if (stage === "login") return <LoginPage onLogin={handleLogin} />
  if (stage === "disclaimer") return <DisclaimerPage onAccept={handleAcceptDisclaimer} />
  return (
    <><JarvisChatPage onLogout={handleLogout} /><Toaster /></>
  )
}

export default App
