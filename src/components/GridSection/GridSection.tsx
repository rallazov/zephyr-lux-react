import React from 'react';
import './GridSection.css'; // Ensure the path is correct

interface GridItem {
  imgSrc?: string; // Optional for sale items
  description?: string; // Optional for sale items
  saleText?: string; // For sale items
  isSale?: boolean;
}

interface GridSectionProps {
  items: GridItem[];
}

const GridSection: React.FC<GridSectionProps> = ({ items }) => {
  return (
    <div className="grid-container">
      {items.map((item, index) => (
        <div key={index} className={`grid-item ${item.isSale ? 'sale-item' : ''}`}>
          {item.isSale ? (
            <div>{item.saleText}</div>
          ) : (
            <>
              <img src={item.imgSrc} alt={`Grid Item ${index}`} />
              {item.description && <p>{item.description}</p>}
            </>
          )}
        </div>
      ))}
    </div>
  );
};

export default GridSection;
