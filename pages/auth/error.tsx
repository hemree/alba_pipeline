import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function AuthError() {
  const router = useRouter();
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (router.query.error) {
      setError(router.query.error as string);
    }
  }, [router.query.error]);

  const getErrorMessage = (errorCode: string) => {
    switch (errorCode) {
      case "AccessDenied":
        return "Access denied. Your email is not whitelisted for this application.";
      case "Configuration":
        return "There is a problem with the server configuration.";
      case "Verification":
        return "The verification token has expired or has already been used.";
      default:
        return "An error occurred during authentication.";
    }
  };

  return (
    <div style={{
      display: "grid",
      placeItems: "center",
      height: "100vh",
      fontFamily: "system-ui, sans-serif",
      background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)"
    }}>
      <div style={{
        background: "white",
        padding: "40px",
        borderRadius: "16px",
        boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
        textAlign: "center",
        maxWidth: "500px",
        width: "90%"
      }}>
        <div style={{
          width: "64px",
          height: "64px",
          backgroundColor: "#fef2f2",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 24px"
        }}>
          <svg 
            style={{ width: "32px", height: "32px", color: "#ef4444" }}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path 
              fillRule="evenodd" 
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" 
              clipRule="evenodd" 
            />
          </svg>
        </div>
        
        <h1 style={{
          fontSize: "24px",
          fontWeight: "bold",
          marginBottom: "16px",
          color: "#1f2937"
        }}>
          Authentication Error
        </h1>
        
        <p style={{
          color: "#6b7280",
          marginBottom: "32px",
          fontSize: "16px",
          lineHeight: "1.5"
        }}>
          {getErrorMessage(error)}
        </p>
        
        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          <button 
            onClick={() => router.push('/login')}
            style={{
              padding: "12px 24px",
              backgroundColor: "#2563eb",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "16px",
              fontWeight: "500"
            }}
          >
            Try Again
          </button>
          
          <button 
            onClick={() => router.push('/')}
            style={{
              padding: "12px 24px",
              backgroundColor: "#6b7280",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "16px",
              fontWeight: "500"
            }}
          >
            Go Home
          </button>
        </div>
        
        <p style={{
          marginTop: "24px",
          fontSize: "14px",
          color: "#9ca3af"
        }}>
          Contact admin if you believe this is an error.
        </p>
      </div>
    </div>
  );
}
