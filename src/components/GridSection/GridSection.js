import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import './GridSection.css'; // Ensure the path is correct
const GridSection = ({ items }) => {
    return (_jsx("div", { className: "grid-container", children: items.map((item, index) => (_jsx("div", { className: `grid-item ${item.isSale ? 'sale-item' : ''}`, children: item.isSale ? (_jsx("div", { children: item.saleText })) : (_jsxs(_Fragment, { children: [_jsx("img", { src: item.imgSrc, alt: `Grid Item ${index}` }), item.description && _jsx("p", { children: item.description })] })) }, index))) }));
};
export default GridSection;
