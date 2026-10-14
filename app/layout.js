import "./globals.css";

export const metadata = {
  title: "SFO Arrivals",
  description: "Upcoming arrivals at San Francisco International Airport.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
