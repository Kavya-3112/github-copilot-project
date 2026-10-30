package tests;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.openqa.selenium.support.ui.ExpectedConditions;

import java.time.Duration;
import static org.junit.jupiter.api.Assertions.*;

/**
 * Selenium/JUnit sanity tests for FR-12 (local login gate).
 *
 * NOTE: FR-12 is implemented in PR #5 but is not listed in requirements.md/architecture.md
 * as a formally approved requirement. These tests trace to PR #5 scope/acceptance behavior.
 */
public class LoginGateTest {
  private WebDriver driver;
  private WebDriverWait wait;
  private String baseUrl;

  @BeforeEach
  void setUp() {
    baseUrl = System.getProperty("baseUrl", "http://localhost:5173");
    ChromeOptions options = new ChromeOptions();
    // Runners can set HEADLESS=true in CI to avoid display requirement.
    if ("true".equalsIgnoreCase(System.getenv("HEADLESS"))) {
      options.addArguments("--headless=new");
      options.addArguments("--disable-gpu");
    }
    driver = new ChromeDriver(options);
    wait = new WebDriverWait(driver, Duration.ofSeconds(10));
  }

  @AfterEach
  void tearDown() {
    if (driver != null) {
      driver.quit();
    }
  }

  private WebElement testId(String id) {
    return driver.findElement(By.cssSelector("[data-testid='" + id + "']"));
  }

  private void gotoHome() {
    driver.get(baseUrl + "/");
    wait.until(ExpectedConditions.visibilityOfElementLocated(By.cssSelector("[data-testid='login-form']")));
  }

  @Test
  @DisplayName("Login form is available by default")
  void loginFormIsVisibleByDefault() {
    gotoHome();
    assertDoesNotThrow(() -> testId("login-form"));
  }

  @Test
  @DisplayName("Setup and authenticate shows contact manager")
  void setupAndAuthShowsContactManager() {
    gotoHome();

    driver.findElement(By.xpath("//label[contains(.,'Username')]/following::input[1]")).sendKeys("testuser");
    driver.findElement(By.xpath("//label[contains(.,'Passcode')]/following::input[1]")).sendKeys("123456");
    driver.findElement(By.xpath("//button[contains(.,'Set up')]")).click();

    wait.until(ExpectedConditions.visibilityOfElementLocated(By.cssSelector("[data-testid='contact-manager']")));
    assertThrows(org.openqa.selenium.NoSuchElementException.class, () -> testId("login-form"));
  }
}
