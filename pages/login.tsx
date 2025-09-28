import { signIn, signOut, useSession } from "next-auth/react";
import { useEffect } from "react";

export default function LoginPage() {
  const { data: session, status } = useSession();

  // Redirect to main app if already logged in
  useEffect(() => {
    if (session) {
      window.location.href = '/';
    }
  }, [session]);

  if (status === "loading") {
    return (
      <div style={{
        display: "grid",
        placeItems: "center",
        height: "100vh",
        fontFamily: "system-ui, sans-serif"
      }}>
        <div>Loading...</div>
      </div>
    );
  }

  if (session) {
    return (
      <div style={{
        display: "grid",
        placeItems: "center",
        height: "100vh",
        fontFamily: "system-ui, sans-serif",
        textAlign: "center"
      }}>
        <div>
          <h2>Welcome to Alba Media Pipeline</h2>
          <p>Hello {session.user?.name || session.user?.email}</p>
          <p>Email: {session.user?.email}</p>
          <div style={{ marginTop: "20px" }}>
            <button 
              onClick={() => signOut()}
              style={{
                padding: "12px 24px",
                backgroundColor: "#dc2626",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "16px",
                marginRight: "10px"
              }}
            >
              Sign Out
            </button>
            <button 
              onClick={() => window.location.href = '/'}
              style={{
                padding: "12px 24px",
                backgroundColor: "#2563eb",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "16px"
              }}
            >
              Go to App
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: "grid",
      placeItems: "center",
      height: "100vh",
      fontFamily: "system-ui, sans-serif",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
    }}>
      <div style={{
        background: "white",
        padding: "40px",
        borderRadius: "16px",
        boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
        textAlign: "center",
        maxWidth: "400px",
        width: "90%"
      }}>
        <h1 style={{
          fontSize: "28px",
          fontWeight: "bold",
          marginBottom: "8px",
          color: "#1f2937"
        }}>
          Alba Media Pipeline
        </h1>
        <p style={{
          color: "#6b7280",
          marginBottom: "32px",
          fontSize: "16px"
        }}>
          AI-powered video generation platform
        </p>
        
        <button 
          onClick={() => signIn("google")}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            padding: "12px 24px",
            backgroundColor: "#4285f4",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "16px",
            fontWeight: "500",
            transition: "background-color 0.2s"
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#3367d6"}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#4285f4"}
        >
          <svg 
            style={{ marginRight: "12px", width: "20px", height: "20px" }}
            viewBox="0 0 24 24"
          >
            <path 
              fill="white" 
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path 
              fill="white" 
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path 
              fill="white" 
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path 
              fill="white" 
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Sign in with Google
        </button>
        
        <p style={{
          marginTop: "24px",
          fontSize: "14px",
          color: "#9ca3af"
        }}>
          Only whitelisted users can sign in.
        </p>
      </div>
    </div>
  );
}
