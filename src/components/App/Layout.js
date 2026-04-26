import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Outlet } from "react-router-dom";
import Footer from "../Footer/Footer";
import Header from "../Header/Header";
const Layout = () => {
    return (_jsxs("div", { className: "App", children: [_jsx(Header, {}), _jsx(Outlet, {}), _jsx(Footer, {})] }));
};
export default Layout;
