package com.appTest.bazar.controllers;

import com.appTest.bazar.dto.productSale.ProductMostSoldDTO;
import com.appTest.bazar.dto.productSale.ProductSaleDTO;
import com.appTest.bazar.models.ProductSale;
import com.appTest.bazar.services.IProductSaleService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping ("/sale-details")
public class ProductSaleController {

    @Autowired
    private IProductSaleService servProdSale;

    @GetMapping
    public ResponseEntity<List<ProductSaleDTO>> getAllProductSale() {
        List<ProductSale> productSaleList = servProdSale.getAllProductSale();

        List<ProductSaleDTO> productSaleDTOList = productSaleList.stream()
                .map(productSale -> servProdSale.convertProductSaleToDto(productSale))
                .collect(Collectors.toList());

        return ResponseEntity.ok(productSaleDTOList);
    }

    @GetMapping ("/{id}")
    public ResponseEntity<ProductSaleDTO> getProductSaleById(@PathVariable Long id) {
        ProductSale productSale = servProdSale.getProductSaleById(id);
        if (productSale == null) {
            return ResponseEntity.notFound().build();
        }
        ProductSaleDTO productSaleDTO = servProdSale.convertProductSaleToDto(productSale);
        return ResponseEntity.ok(productSaleDTO);
    }

    @GetMapping ("/product-most-sold")
    public ResponseEntity<ProductMostSoldDTO> getProductMostSold() {
        ProductMostSoldDTO productMostSoldDTO = servProdSale.getMostSoldProduct();
        return ResponseEntity.ok(productMostSoldDTO);
    }

    @DeleteMapping ("/{id}")
    public ResponseEntity<String> deleteProductSaleById (@PathVariable Long id) {
        boolean deleted = servProdSale.deleteProductSaleById(id);
        if (deleted) {
            return ResponseEntity.ok("The sale detail has been successfully deleted.");
        }
        return ResponseEntity.notFound().build();
    }
}
