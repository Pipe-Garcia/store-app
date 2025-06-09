package com.appTest.bazar.controllers;

import com.appTest.bazar.dto.product.*;
import com.appTest.bazar.models.Product;
import com.appTest.bazar.services.IProductService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping ("/products")
public class ProductController {

    @Autowired
    private IProductService servProd;

    @GetMapping
    public ResponseEntity<List<ProductDTO>> getAllProducts() {
        List<Product> productList = servProd.getAllProducts();

        List<ProductDTO> productDTOList = productList.stream()
                                            .map(product -> servProd.convertProductToDto(product))
                                            .collect(Collectors.toList());

        return ResponseEntity.ok(productDTOList);
    }

    @GetMapping ("/{id}")
    public ResponseEntity<ProductDTO> getProductById(@PathVariable Long id) {
        Product product = servProd.getProductById(id);
        if (product == null) {
            return ResponseEntity.notFound().build();
        }
        ProductDTO productDTO = servProd.convertProductToDto(product);
        return ResponseEntity.ok(productDTO);
    }

    @GetMapping ("/stock-alert")
    public ResponseEntity<List<ProductStockAlertDTO>> getProductsWithLowStock() {
        List<ProductStockAlertDTO> productStockAlertDTOList = servProd.getProductsWithLowStock();
        return ResponseEntity.ok(productStockAlertDTOList);
    }

    @GetMapping ("/most-expensive")
    public ResponseEntity<ProductMostExpensiveDTO> getProductByHighestPrice() {
        ProductMostExpensiveDTO productMostExpensiveDTO = servProd.getProductByHighestPrice();
        return ResponseEntity.ok(productMostExpensiveDTO);
    }

    @PostMapping
    public ResponseEntity<String> createProduct(@RequestBody @Valid ProductCreateDTO dto) {
        servProd.createProduct(dto);
        return ResponseEntity.status(HttpStatus.CREATED).body("The product has been successfully created.");
    }

    @PutMapping
    public ResponseEntity<String> updateProduct(@RequestBody ProductUpdateDTO dto) {
        servProd.updateProduct(dto);
        return ResponseEntity.ok().body("The product has been successfully updated.");
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<String> deleteProductById(@PathVariable Long id) {
        boolean deleted = servProd.deleteProductById(id);
        if (deleted) {
            return ResponseEntity.ok("The product has been successfully deleted.");
        }
        return ResponseEntity.notFound().build();
    }

}
