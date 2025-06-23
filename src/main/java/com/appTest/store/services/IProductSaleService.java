package com.appTest.store.services;

import com.appTest.store.dto.productSale.ProductMostSoldDTO;
import com.appTest.store.dto.productSale.ProductSaleDTO;
import com.appTest.store.models.ProductSale;

import java.util.List;

public interface IProductSaleService {

      public List<ProductSale> getAllProductSale();

      public ProductSale getProductSaleById(Long idProductSale);

      public ProductSaleDTO convertProductSaleToDto(ProductSale productSale);

      public ProductMostSoldDTO getMostSoldProduct();

      public boolean deleteProductSaleById(Long idProductSale);
}
