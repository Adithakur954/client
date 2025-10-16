import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";

// Basic styles as optional (can be removed if raw HTML is preferred)
const basicOverlayStyle = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(0, 0, 0, 0.5)",
  zIndex: 50,
};

const basicContentStyle = {
  position: "fixed",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  background: "white",
  padding: "1.5rem",
  borderRadius: "0.5rem",
  maxWidth: "90%",
  width: "50%",
  zIndex: 51,
};

function Dialog(props) {
  return <DialogPrimitive.Root {...props} />;
}

function DialogTrigger(props) {
  return <DialogPrimitive.Trigger {...props} />;
}

function DialogPortal(props) {
  return <DialogPrimitive.Portal {...props} />;
}

function DialogOverlay(props) {
  return <DialogPrimitive.Overlay style={basicOverlayStyle} {...props} />;
}

function DialogContent({ children, showCloseButton = true, ...props }) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content style={basicContentStyle} {...props}>
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            style={{
              position: "absolute",
              top: "0.5rem",
              right: "0.5rem",
              background: "white",
              border: "none",
              cursor: "pointer",
              text: "black"
            }}
          >
            <XIcon size={16} />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogClose(props) {
  return <DialogPrimitive.Close {...props} />;
}

function DialogHeader(props) {
  return <div style={{ marginBottom: "1rem" }} {...props} />;
}

function DialogFooter(props) {
  return <div style={{ marginTop: "1rem", textAlign: "right" }} {...props} />;
}

function DialogTitle(props) {
  return (
    <DialogPrimitive.Title
      style={{ fontSize: "1.25rem", fontWeight: "bold", marginBottom: "0.5rem" }}
      {...props}
    />
  );
}

function DialogDescription(props) {
  return (
    <DialogPrimitive.Description
      style={{ fontSize: "0.875rem", color: "#666" }}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogClose,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
