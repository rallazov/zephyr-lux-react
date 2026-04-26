import { jsx as _jsx } from "react/jsx-runtime";
import Navbar from "../Navbar/Navbar";
import "./Header.css";
const Header = () => {
    return (_jsx("header", { children: _jsx(Navbar, {}) }));
};
export default Header;
