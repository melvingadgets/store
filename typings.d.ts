import React from "react"
declare module "@material-tailwind/react"{
    interface CarouselProps {
        className?: string;
        children?: React.ReactNode
    }
    interface TypographyProps {
        variant?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "paragraph" | "small";
        color?: "blue-gray" | "gray" | "blue";
        className?: string;
        as?: React.ElementType;
      }
      interface InputProps {
        label?: string;
        size?: "sm" | "md" | "lg";
      }
      interface CheckboxProps {
        label?: string;
      }
      interface ButtonProps {
        variant?: "text" | "outlined" | "contained" | "gradient";
        color?: "blue" | "gray" | "green" | "red" | "yellow";
        onClick?: () => void;
        fullWidth?: boolean;
      }
    //export thet extended types
    export const Carousel: React.FC<CarouselProps>
    export const Typography: React.FC<TypographyProps>
    export const Input: React.FC<InputProps>
    export const Checkbox: React.FC<CheckboxProps>
    export const Button: React.FC<ButtonProps>
}
