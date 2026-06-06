"use client";

import { useEffect, useState, useRef } from "react";
import { driver, Driver } from "driver.js";
import "driver.js/dist/driver.css";

const TOUR_KEY = "arivu_tour_done";

export function useOnboardingTour() {
  const driverRef = useRef<Driver | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(TOUR_KEY)) return;

    driverRef.current = driver({
      showProgress: true,
      animate: true,
      allowClose: true,
      overlayOpacity: 0.7,
      steps: [
        {
          popover: {
            title: "Welcome to Arivu!",
            description: "Your AI-powered database assistant. Let's take a quick tour.",
          },
        },
        {
          element: "[data-tour='sidebar']",
          popover: {
            title: "Navigation",
            description: "Use the sidebar to navigate between workspace, analytics, and monitoring sections.",
          },
        },
        {
          element: "[data-tour='chat']",
          popover: {
            title: "Chat with your Database",
            description: "Ask questions in natural language. Arivu translates them to SQL and shows results.",
          },
        },
        {
          element: "[data-tour='explorer']",
          popover: {
            title: "DB Explorer",
            description: "Browse your database tables, view schemas, and preview data.",
          },
        },
        {
          element: "[data-tour='dashboards']",
          popover: {
            title: "Dashboards",
            description: "Create persistent grids of AI-generated charts. Pin visualizations from chat.",
          },
        },
        {
          element: "[data-tour='monitoring']",
          popover: {
            title: "Monitoring",
            description: "Track traces, sessions, errors, and RLHF feedback in real-time.",
          },
        },
        {
          popover: {
            title: "You're all set!",
            description: "Start by connecting a database or exploring the chat interface. Press Ctrl+K anytime for quick navigation.",
          },
        },
      ],
      onDestroyed: () => {
        localStorage.setItem(TOUR_KEY, "true");
      },
    });

    setInitialized(true);
  }, []);

  const startTour = () => {
    if (driverRef.current) {
      localStorage.removeItem(TOUR_KEY);
      driverRef.current.drive();
    }
  };

  return { initialized, startTour };
}
