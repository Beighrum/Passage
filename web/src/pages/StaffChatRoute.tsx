import { Navigate } from "react-router-dom";
import PassageChat from "../components/PassageChat";
import { useStaffSession } from "../hooks/useStaffSession";

export default function StaffChatRoute() {
  const session = useStaffSession();

  if (session === "loading") {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          color: "#555",
        }}
      >
        Checking staff session…
      </div>
    );
  }

  if (session === "no") {
    return <Navigate to="/staff" replace />;
  }

  return <PassageChat variant="internal" />;
}
