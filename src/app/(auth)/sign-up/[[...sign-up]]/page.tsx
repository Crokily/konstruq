import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <SignUp
        appearance={{
          elements: {
            rootBox: "mx-auto",
            cardBox: "shadow-xl shadow-amber-500/5",
          },
        }}
      />
    </div>
  );
}
