
import React from 'react';
import { NavLink } from 'react-router-dom';
import { FaCog, FaHome, FaShoppingCart } from 'react-icons/fa';

interface NavLinkProps {
  Icon: React.ElementType;
  link: string;
  label: string;
}

const CustomNavLink: React.FC<NavLinkProps> = ({ Icon, link, label }) => {
  return (
    <NavLink
      to={link}
      className={({ isActive }) =>
        `ios-tab ${isActive ? 'ios-tab-active' : ''}`
      }
    >
      <Icon className="h-5 w-5" />
      <span className="truncate">{label}</span>
    </NavLink>
  );
};

const Footer: React.FC = () => {
  return (
    <footer className="ios-tabbar">
      <CustomNavLink Icon={FaHome} link="/" label="Home" />
      <CustomNavLink Icon={FaShoppingCart} link="/cart" label="Cart" />
      <CustomNavLink Icon={FaCog} link="/account" label="Account" />
    </footer>
  );
};

export default Footer;
