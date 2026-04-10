import { Routes, Route } from "react-router-dom";
import PassageChat from "./components/PassageChat";
import StaffLogin from "./pages/StaffLogin";
import StaffChatRoute from "./pages/StaffChatRoute";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PassageChat variant="public" />} />
      <Route path="/staff" element={<StaffLogin />} />
      <Route path="/staff/chat" element={<StaffChatRoute />} />
    </Routes>
  );
}
