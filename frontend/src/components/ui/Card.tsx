import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}
interface CardSectionProps extends React.HTMLAttributes<HTMLDivElement> {}

function CardRoot({ className = '', children, ...rest }: CardProps) {
  return (
    <div
      className={`bg-parchment-100 border border-parchment-300 rounded-lg shadow-card ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

function CardHeader({ className = '', children, ...rest }: CardSectionProps) {
  return (
    <div
      className={`px-5 py-4 border-b border-parchment-300 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

function CardBody({ className = '', children, ...rest }: CardSectionProps) {
  return (
    <div className={`px-5 py-4 ${className}`} {...rest}>
      {children}
    </div>
  );
}

function CardFooter({ className = '', children, ...rest }: CardSectionProps) {
  return (
    <div
      className={`px-5 py-3 border-t border-parchment-300 bg-parchment-50 rounded-b-lg ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export const Card = Object.assign(CardRoot, {
  Header: CardHeader,
  Body: CardBody,
  Footer: CardFooter,
});
