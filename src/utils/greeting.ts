export const getGreeting = (name: string): string => {
  const hour = new Date().getHours();
  if (hour >= 4 && hour < 12) return `Good morning, ${name}`;
  if (hour >= 12 && hour < 17) return `Good afternoon, ${name}`;
  return `Good evening, ${name}`;
};
