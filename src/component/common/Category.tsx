import React from "react";
import { useNavigate } from "react-router-dom";
import wearables from "../../assets/images/fashion-removebg-preview.png"
import card from "../../assets/images/memory/cat1.png"
import game from "../../assets/images/memory/xbox-1-removebg-preview.png"
import phones from "../../assets/images/Phones-removebg-preview.png"
import charger from "../../assets/images/memory/phonecharger-removebg-preview.png"
import accessories from "../../assets/images/memory/category1-removebg-preview.png"
import { useGetCategoriesQuery } from "../../redux/shopApi";
import type { Category } from "../../types/domain";

interface CardData {
  image: string;
  title: string;
  onClick: () => void;
}

const CategoryCard: React.FC<CardData> = ({ image, title, onClick }) => {
  return (
    <button type="button" onClick={onClick} className="flex flex-col text-left transition duration-200 active:scale-[0.98]">
      <div className="ios-card-soft flex h-28 min-w-[122px] flex-col items-center justify-center p-2">
        <img src={image} alt="" className="max-h-full p-1" />
      </div>
      <p className="mt-2 text-center ios-meta font-semibold">
        {title}
      </p>
    </button>
  );
};

const CategoryGrid: React.FC = () => {
  const navigate = useNavigate()
  const { data: categories = [] } = useGetCategoriesQuery()

  const categoryImages = [wearables, game, phones, card, accessories, charger]
  const categoryCards: CardData[] = categories.map((category: Category, index) => ({
    image: categoryImages[index % categoryImages.length],
    title: category.name,
    onClick: () => navigate(`/product?category=${category._id}`),
  }))

  return (
    <section className="pt-5">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="ios-section-title">Categories</h1>
        <span className="ios-pill">Shop by type</span>
      </div>
      <div className="flex gap-3 overflow-x-auto scrollbar-hide scroll-smooth pb-1" style={{ WebkitOverflowScrolling: "touch" }}>
        {categoryCards.map((category, index) => (
          <CategoryCard key={index} image={category.image} title={category.title} onClick={category.onClick} />
        ))}
      </div>
    </section>
  );
};

export default CategoryGrid;
