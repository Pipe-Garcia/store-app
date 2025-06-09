package com.appTest.bazar.services;

import com.appTest.bazar.dto.product.*;
import com.appTest.bazar.models.Product;
import com.appTest.bazar.repositories.IProductRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ProductService implements IProductService{

    @Autowired
    private IProductRepository repoProd;

    @Override
    public List<Product> getAllProducts() {
        return repoProd.findAll();
    }

    @Override
    public ProductDTO convertProductToDto(Product product) {
        int totalSales = (product.getProductSaleList() != null) ? product.getProductSaleList().size() : 0;

        return new ProductDTO(
                product.getBrand(),
                product.getName(),
                product.getPrice(),
                product.getQuantityAvailable(),
                totalSales
        );
    }

    @Override
    public Product getProductById(Long idProduct) {
        return repoProd.findById(idProduct).orElse(null);
    }

    @Override
    public List<ProductStockAlertDTO> getProductsWithLowStock() {
        return repoProd.getProductsWithLowStock();
    }

    @Override
    public ProductMostExpensiveDTO getProductByHighestPrice() {
        List<ProductMostExpensiveDTO> list = repoProd.getProductByHighestPrice();
        return list.isEmpty() ? null : list.get(0);
    }

    @Override
    public void createProduct(ProductCreateDTO dto) {
        Product product = new Product();
        product.setName(dto.getName());
        product.setBrand(dto.getBrand());
        product.setPrice(dto.getPrice());

        repoProd.save(product);
    }

    @Override
    public void updateProduct(ProductUpdateDTO dto) {
        Product product = repoProd.findById(dto.getIdProduct()).orElse(null);

        if (product != null) {
            if (dto.getName() != null) product.setName(dto.getName());
            if (dto.getBrand() != null) product.setBrand(dto.getBrand());
            if (dto.getPrice() != null) product.setPrice(dto.getPrice());
            if (dto.getQuantityAvailable() != null) product.setQuantityAvailable(dto.getQuantityAvailable());

            repoProd.save(product);
        }
    }

    @Override
    public boolean deleteProductById(Long idProduct) {
        Product product = repoProd.findById(idProduct).orElse(null);
        if (product != null) {
            repoProd.delete(product);
            return true;
        }
        return false;
    }

}
