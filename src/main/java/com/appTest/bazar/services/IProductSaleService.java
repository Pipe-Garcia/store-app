package com.appTest.bazar.services;

import com.appTest.bazar.dto.productSale.ProductMostSoldDTO;
import com.appTest.bazar.dto.productSale.ProductSaleDTO;
import com.appTest.bazar.models.ProductSale;

import java.util.List;

public interface IProductSaleService {

      public List<ProductSale> getAllProductSale();

      public ProductSale getProductSaleById(Long idProductSale);

      public ProductSaleDTO convertProductSaleToDto(ProductSale productSale);

      public ProductMostSoldDTO getMostSoldProduct();

      public boolean deleteProductSaleById(Long idProductSale);
}
